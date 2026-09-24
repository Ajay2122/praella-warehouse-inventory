import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { assertOrgScope } from '../../lib/orgScope';
import { applyMovement } from '../../lib/inventory';
import { resolveWarehouseAccess } from '../../lib/warehouseAccess';
import { paginationArgs, paginationMeta, type PaginationInput } from '../../lib/pagination';
import { invalidateInventoryCaches } from '../../lib/cache';
import type { AuthenticatedUser } from '../../types/express';
import type { CreateSalesOrderInput } from './salesOrder.schemas';

// Unlike purchase orders, Staff can create/confirm/dispatch sales orders -
// dispatching an order is the outbound equivalent of "record a stock
// movement", which the brief explicitly allows Staff to do. Only warehouse
// membership is required, no extra role gate.

export async function createSalesOrder(input: CreateSalesOrderInput, actor: AuthenticatedUser) {
  await resolveWarehouseAccess(input.warehouseId, actor);

  const products = await prisma.product.findMany({
    where: { id: { in: input.lines.map((l) => l.productId) } },
  });
  if (products.length !== new Set(input.lines.map((l) => l.productId)).size) {
    throw new AppError('VALIDATION_ERROR', 'One or more line productId values are invalid');
  }
  for (const product of products) assertOrgScope(product.organizationId, actor.organizationId);

  return prisma.salesOrder.create({
    data: {
      organizationId: actor.organizationId,
      warehouseId: input.warehouseId,
      createdById: actor.id,
      status: 'DRAFT',
      lines: { create: input.lines },
    },
    include: { lines: { include: { product: true } }, warehouse: true },
  });
}

interface ListParams extends PaginationInput {
  warehouseId?: string;
  status?: string;
  user: AuthenticatedUser;
}

export async function listSalesOrders(params: ListParams) {
  if (params.warehouseId) await resolveWarehouseAccess(params.warehouseId, params.user);

  const where: Prisma.SalesOrderWhereInput = {
    organizationId: params.user.organizationId,
    ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
    ...(params.status ? { status: params.status as Prisma.EnumSalesOrderStatusFilter['equals'] } : {}),
    ...(params.user.role === 'ADMIN' ? {} : { warehouse: { members: { some: { userId: params.user.id } } } }),
  };

  const [data, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      ...paginationArgs(params),
      orderBy: { createdAt: 'desc' },
      include: { lines: true, warehouse: true },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return { data, pagination: paginationMeta(params, total) };
}

export async function getSalesOrder(id: string, organizationId: string) {
  const so = await prisma.salesOrder.findUnique({
    where: { id },
    include: { lines: { include: { product: true } }, warehouse: true },
  });
  if (!so) throw new AppError('NOT_FOUND', 'Sales order not found');
  assertOrgScope(so.organizationId, organizationId);
  return so;
}

export async function confirmSalesOrder(id: string, actor: AuthenticatedUser) {
  const so = await getSalesOrder(id, actor.organizationId);
  await resolveWarehouseAccess(so.warehouseId, actor);
  if (so.status !== 'DRAFT') {
    throw new AppError('BUSINESS_RULE_VIOLATION', `Cannot confirm a sales order in status ${so.status}`);
  }
  return prisma.salesOrder.update({ where: { id }, data: { status: 'CONFIRMED' } });
}

// Dispatch: BEGIN TRANSACTION -> OUTBOUND movement per line (each one
// atomically decrements StockLevel and rejects if insufficient) -> update
// order status -> COMMIT. If line 3 of 5 has insufficient stock, lines 1-2
// are rolled back too - a sales order either fully dispatches or not at
// all, never partially.
export async function dispatchSalesOrder(id: string, actor: AuthenticatedUser) {
  const so = await getSalesOrder(id, actor.organizationId);
  await resolveWarehouseAccess(so.warehouseId, actor);

  if (so.status !== 'CONFIRMED') {
    throw new AppError('BUSINESS_RULE_VIOLATION', `Cannot dispatch a sales order in status ${so.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const line of so.lines) {
      await applyMovement(tx, {
        productId: line.productId,
        type: 'OUTBOUND',
        quantity: line.quantity,
        fromWarehouseId: so.warehouseId,
        actorUserId: actor.id,
        referenceType: 'SALES_ORDER',
        referenceId: so.id,
      });
    }
    return tx.salesOrder.update({
      where: { id },
      data: { status: 'DISPATCHED' },
      include: { lines: true },
    });
  });
  await invalidateInventoryCaches(actor.organizationId);
  return updated;
}

export async function cancelSalesOrder(id: string, actor: AuthenticatedUser) {
  const so = await getSalesOrder(id, actor.organizationId);
  await resolveWarehouseAccess(so.warehouseId, actor);

  if (so.status === 'DISPATCHED') {
    throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot cancel a sales order that has already been dispatched');
  }
  if (so.status === 'CANCELLED') {
    throw new AppError('BUSINESS_RULE_VIOLATION', 'Sales order is already cancelled');
  }
  return prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
}
