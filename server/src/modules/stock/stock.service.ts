import crypto from 'crypto';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { assertOrgScope } from '../../lib/orgScope';
import { applyMovement } from '../../lib/inventory';
import { effectiveWarehouseRole, resolveWarehouseAccess } from '../../lib/warehouseAccess';
import { paginationArgs, paginationMeta, type PaginationInput } from '../../lib/pagination';
import { cacheGetOrSet, cacheKeys, hashQuery, invalidateInventoryCaches } from "../../lib/cache";
import type { AuthenticatedUser } from '../../types/express';
import type { RecordMovementInput, TransferInput, UpsertReplenishmentRuleInput } from './stock.schemas';

// Staff can record routine INBOUND/OUTBOUND movements but not ADJUSTMENT
// (a correction, more sensitive) or TRANSFER (its own endpoint below) -
// matches the practical test brief's RBAC examples.
const STAFF_ALLOWED_MOVEMENT_TYPES = new Set(['INBOUND', 'OUTBOUND']);

async function assertProductInOrg(productId: string, organizationId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found');
  assertOrgScope(product.organizationId, organizationId);
  return product;
}

function warehouseScopeFilter(user: AuthenticatedUser) {
  return user.role === 'ADMIN' ? {} : { members: { some: { userId: user.id } } };
}

// --- Stock levels -----------------------------------------------------

interface ListLevelsParams extends PaginationInput {
  warehouseId?: string;
  productId?: string;
  user: AuthenticatedUser;
}

export async function listStockLevels(params: ListLevelsParams) {
  if (params.warehouseId) {
    await resolveWarehouseAccess(params.warehouseId, params.user);
  }

  const cacheKey = cacheKeys.stockLevels(
    params.user.organizationId,
    hashQuery({
      page: params.page,
      pageSize: params.pageSize,
      warehouseId: params.warehouseId,
      productId: params.productId,
      scope: params.warehouseId ?? `role:${params.user.role}:${params.user.id}`,
    }),
  );

  return cacheGetOrSet(cacheKey, async () => {
    const where: Prisma.StockLevelWhereInput = {
      ...(params.warehouseId
        ? { warehouseId: params.warehouseId }
        : { warehouse: { organizationId: params.user.organizationId, ...warehouseScopeFilter(params.user) } }),
      ...(params.productId ? { productId: params.productId } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.stockLevel.findMany({
        where,
        ...paginationArgs(params),
        orderBy: { updatedAt: 'desc' },
        include: { product: true, warehouse: true },
      }),
      prisma.stockLevel.count({ where }),
    ]);

    return { data, pagination: paginationMeta(params, total) };
  });
}

// --- Movements ----------------------------------------------------------

interface ListMovementsParams extends PaginationInput {
  warehouseId?: string;
  productId?: string;
  type?: string;
  from?: Date;
  to?: Date;
  user: AuthenticatedUser;
}

export async function listMovements(params: ListMovementsParams) {
  if (params.warehouseId) {
    await resolveWarehouseAccess(params.warehouseId, params.user);
  }

  const warehouseFilter = params.warehouseId
    ? { OR: [{ fromWarehouseId: params.warehouseId }, { toWarehouseId: params.warehouseId }] }
    : {
        OR: [
          { fromWarehouse: { organizationId: params.user.organizationId, ...warehouseScopeFilter(params.user) } },
          { toWarehouse: { organizationId: params.user.organizationId, ...warehouseScopeFilter(params.user) } },
        ],
      };

  const where: Prisma.StockMovementWhereInput = {
    ...warehouseFilter,
    ...(params.productId ? { productId: params.productId } : {}),
    ...(params.type ? { type: params.type as Prisma.EnumMovementTypeFilter['equals'] } : {}),
    ...(params.from || params.to
      ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      ...paginationArgs(params),
      orderBy: { createdAt: 'desc' },
      include: { product: true, fromWarehouse: true, toWarehouse: true, actor: { select: { id: true, email: true } } },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { data, pagination: paginationMeta(params, total) };
}

export async function recordMovement(input: RecordMovementInput, actor: AuthenticatedUser) {
  const { membership } = await resolveWarehouseAccess(input.warehouseId, actor);
  const role = effectiveWarehouseRole(actor, membership);

  if (!STAFF_ALLOWED_MOVEMENT_TYPES.has(input.type) && role === 'STAFF') {
    throw new AppError('FORBIDDEN', 'Staff can only record INBOUND/OUTBOUND movements');
  }

  await assertProductInOrg(input.productId, actor.organizationId);

  const direction = input.type === 'INBOUND' ? 'IN' : input.type === 'OUTBOUND' ? 'OUT' : input.direction;

  const movement = await prisma.$transaction((tx) =>
    applyMovement(tx, {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      toWarehouseId: direction === 'IN' ? input.warehouseId : undefined,
      fromWarehouseId: direction === 'OUT' ? input.warehouseId : undefined,
      actorUserId: actor.id,
      referenceType: 'MANUAL',
    }),
  );
  await invalidateInventoryCaches(actor.organizationId);
  return movement;
}

// --- Transfers ------------------------------------------------------------

export async function transferStock(input: TransferInput, actor: AuthenticatedUser) {
  const [{ membership: fromMembership }, { membership: toMembership }] = await Promise.all([
    resolveWarehouseAccess(input.fromWarehouseId, actor),
    resolveWarehouseAccess(input.toWarehouseId, actor),
  ]);

  const fromRole = effectiveWarehouseRole(actor, fromMembership);
  const toRole = effectiveWarehouseRole(actor, toMembership);
  if (fromRole === 'STAFF' || toRole === 'STAFF') {
    throw new AppError('FORBIDDEN', 'Staff cannot transfer stock between warehouses');
  }

  await assertProductInOrg(input.productId, actor.organizationId);

  const referenceId = crypto.randomUUID();

  // Both legs of the transfer happen inside one transaction: if the
  // TRANSFER_OUT decrement fails (insufficient stock), the TRANSFER_IN
  // never runs and the whole thing rolls back - no stock can vanish or
  // appear from a partially-applied transfer.
  const result = await prisma.$transaction(async (tx) => {
    const out = await applyMovement(tx, {
      productId: input.productId,
      type: 'TRANSFER_OUT',
      quantity: input.quantity,
      fromWarehouseId: input.fromWarehouseId,
      actorUserId: actor.id,
      referenceType: 'TRANSFER',
      referenceId,
    });
    const inbound = await applyMovement(tx, {
      productId: input.productId,
      type: 'TRANSFER_IN',
      quantity: input.quantity,
      toWarehouseId: input.toWarehouseId,
      actorUserId: actor.id,
      referenceType: 'TRANSFER',
      referenceId,
    });
    return { referenceId, out, in: inbound };
  });
  await invalidateInventoryCaches(actor.organizationId);
  return result;
}

interface ListTransfersParams extends PaginationInput {
  user: AuthenticatedUser;
}

export async function listTransfers(params: ListTransfersParams) {
  const where: Prisma.StockMovementWhereInput = {
    referenceType: 'TRANSFER',
    type: 'TRANSFER_OUT',
    OR: [
      { fromWarehouse: { organizationId: params.user.organizationId, ...warehouseScopeFilter(params.user) } },
    ],
  };

  const [data, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      ...paginationArgs(params),
      orderBy: { createdAt: 'desc' },
      include: { product: true, fromWarehouse: true },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { data, pagination: paginationMeta(params, total) };
}

// --- Replenishment rules --------------------------------------------------

export async function upsertReplenishmentRule(input: UpsertReplenishmentRuleInput, actor: AuthenticatedUser) {
  await resolveWarehouseAccess(input.warehouseId, actor);
  await assertProductInOrg(input.productId, actor.organizationId);

  const rule = await prisma.replenishmentRule.upsert({
    where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
    create: input,
    update: { minThreshold: input.minThreshold },
  });
  await invalidateInventoryCaches(actor.organizationId);
  return rule;
}

// A product is "low stock" when its StockLevel.quantity is below the
// ReplenishmentRule.minThreshold defined for that same (product,
// warehouse) pair. Prisma can't express a cross-row field comparison in
// `where`, so this is fetched pre-filtered by org/warehouse scope and
// compared in application code - fine at this data scale.
export async function computeLowStockAlerts(actor: Pick<AuthenticatedUser, 'organizationId' | 'role' | 'id'>) {
  const rules = await prisma.replenishmentRule.findMany({
    where: {
      warehouse: { organizationId: actor.organizationId, ...warehouseScopeFilter(actor as AuthenticatedUser) },
    },
    include: { product: true, warehouse: true },
  });

  const levels = await prisma.stockLevel.findMany({
    where: {
      OR: rules.map((r) => ({ productId: r.productId, warehouseId: r.warehouseId })),
    },
  });
  const levelByKey = new Map(levels.map((l) => [`${l.productId}:${l.warehouseId}`, l.quantity]));

  return rules
    .map((rule) => ({
      product: rule.product,
      warehouse: rule.warehouse,
      minThreshold: rule.minThreshold,
      currentQuantity: levelByKey.get(`${rule.productId}:${rule.warehouseId}`) ?? 0,
    }))
    .filter((a) => a.currentQuantity < a.minThreshold);
}

export function replenishmentAlertsCacheKey(organizationId: string, scope: string): string {
  return `replenishment:alerts:${organizationId}:${scope}`;
}

export async function listLowStockAlerts(actor: AuthenticatedUser, params: PaginationInput) {
  // Admins see the org-wide alert set - exactly what the Phase 12
  // replenishment.scan background job pre-warms every 15 minutes, so an
  // Admin's request is usually a cache hit even before they've asked
  // before. Non-admins get a narrower, membership-scoped view that the
  // scan job doesn't pre-compute (it varies per user), cached on-demand
  // with a short TTL instead.
  const scope = actor.role === 'ADMIN' ? 'all' : `member:${actor.id}`;
  const alerts = await cacheGetOrSet(
    replenishmentAlertsCacheKey(actor.organizationId, scope),
    () => computeLowStockAlerts(actor),
    60,
  );

  const total = alerts.length;
  const { skip, take } = paginationArgs(params);
  return { data: alerts.slice(skip, skip + take), pagination: paginationMeta(params, total) };
}
