import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { assertOrgScope } from '../../lib/orgScope';
import { applyMovement } from '../../lib/inventory';
import { effectiveWarehouseRole, resolveWarehouseAccess } from '../../lib/warehouseAccess';
import { paginationArgs, paginationMeta, type PaginationInput } from '../../lib/pagination';
import { invalidateInventoryCaches } from '../../lib/cache';
import type { AuthenticatedUser } from '../../types/express';
import type { CreatePurchaseOrderInput } from './purchaseOrder.schemas';

// Purchase orders commit the organization to buying from a supplier, so
// (unlike sales orders) Staff can view but never create/confirm/receive/
// cancel one - matches the RBAC matrix in ARCHITECTURE.md.
async function assertNotStaff(warehouseId: string, actor: AuthenticatedUser, action: string) {
  const { membership } = await resolveWarehouseAccess(warehouseId, actor);
  if (effectiveWarehouseRole(actor, membership) === 'STAFF') {
    throw new AppError('FORBIDDEN', `Staff cannot ${action} purchase orders`);
  }
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput, actor: AuthenticatedUser) {
  await assertNotStaff(input.warehouseId, actor, 'create');

  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new AppError('VALIDATION_ERROR', 'Invalid supplierId');
  assertOrgScope(supplier.organizationId, actor.organizationId);

  const products = await prisma.product.findMany({
    where: { id: { in: input.lines.map((l) => l.productId) } },
  });
  if (products.length !== new Set(input.lines.map((l) => l.productId)).size) {
    throw new AppError('VALIDATION_ERROR', 'One or more line productId values are invalid');
  }
  for (const product of products) assertOrgScope(product.organizationId, actor.organizationId);

  return prisma.purchaseOrder.create({
    data: {
      organizationId: actor.organizationId,
      warehouseId: input.warehouseId,
      supplierId: input.supplierId,
      createdById: actor.id,
      status: 'DRAFT',
      lines: { create: input.lines },
    },
    include: { lines: { include: { product: true } }, supplier: true, warehouse: true },
  });
}

interface ListParams extends PaginationInput {
  warehouseId?: string;
  status?: string;
  user: AuthenticatedUser;
}

export async function listPurchaseOrders(params: ListParams) {
  if (params.warehouseId) await resolveWarehouseAccess(params.warehouseId, params.user);

  const where: Prisma.PurchaseOrderWhereInput = {
    organizationId: params.user.organizationId,
    ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
    ...(params.status ? { status: params.status as Prisma.EnumPurchaseOrderStatusFilter['equals'] } : {}),
    ...(params.user.role === 'ADMIN' ? {} : { warehouse: { members: { some: { userId: params.user.id } } } }),
  };

  const [data, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      ...paginationArgs(params),
      orderBy: { createdAt: 'desc' },
      include: { lines: true, supplier: true, warehouse: true },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { data, pagination: paginationMeta(params, total) };
}

export async function getPurchaseOrder(id: string, organizationId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: { include: { product: true } }, supplier: true, warehouse: true },
  });
  if (!po) throw new AppError('NOT_FOUND', 'Purchase order not found');
  assertOrgScope(po.organizationId, organizationId);
  return po;
}

export async function confirmPurchaseOrder(id: string, actor: AuthenticatedUser) {
  const po = await getPurchaseOrder(id, actor.organizationId);
  await assertNotStaff(po.warehouseId, actor, 'confirm');
  if (po.status !== 'DRAFT') {
    throw new AppError('BUSINESS_RULE_VIOLATION', `Cannot confirm a purchase order in status ${po.status}`);
  }
  return prisma.purchaseOrder.update({ where: { id }, data: { status: 'CONFIRMED' } });
}

// The critical path: BEGIN TRANSACTION -> apply an INBOUND movement per
// line (which itself atomically updates StockLevel) -> update order status
// -> COMMIT. This all happens synchronously in the request, not handed off
// to a queue - see ARCHITECTURE.md's inventory transaction rule for why.
export async function receivePurchaseOrder(id: string, actor: AuthenticatedUser) {
  const po = await getPurchaseOrder(id, actor.organizationId);
  await assertNotStaff(po.warehouseId, actor, 'receive');

  if (po.status !== 'CONFIRMED') {
    throw new AppError('BUSINESS_RULE_VIOLATION', `Cannot receive a purchase order in status ${po.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const line of po.lines) {
      await applyMovement(tx, {
        productId: line.productId,
        type: 'INBOUND',
        quantity: line.quantity,
        toWarehouseId: po.warehouseId,
        actorUserId: actor.id,
        referenceType: 'PURCHASE_ORDER',
        referenceId: po.id,
      });
    }
    return tx.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED' },
      include: { lines: true },
    });
  });
  await invalidateInventoryCaches(actor.organizationId);
  return updated;
}

export async function cancelPurchaseOrder(id: string, actor: AuthenticatedUser) {
  const po = await getPurchaseOrder(id, actor.organizationId);
  await assertNotStaff(po.warehouseId, actor, 'cancel');

  if (po.status === 'RECEIVED') {
    throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot cancel a purchase order that has already been received');
  }
  if (po.status === 'CANCELLED') {
    throw new AppError('BUSINESS_RULE_VIOLATION', 'Purchase order is already cancelled');
  }
  return prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
}
