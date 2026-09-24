import type { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { assertOrgScope } from '../../lib/orgScope';
import { paginationArgs, paginationMeta, type PaginationInput } from '../../lib/pagination';
import { writeAuditLog } from '../../lib/audit';
import type { AddMemberInput, CreateWarehouseInput, UpdateWarehouseInput } from './warehouse.schemas';

interface ListParams extends PaginationInput {
  search?: string;
  organizationId: string;
  userId: string;
  role: Role;
}

export async function listWarehouses(params: ListParams) {
  const where = {
    organizationId: params.organizationId,
    ...(params.search ? { name: { contains: params.search, mode: 'insensitive' as const } } : {}),
    // Admins see every warehouse in the org; everyone else only sees
    // warehouses they're an explicit member of ("each user should have
    // access only to their own warehouses").
    ...(params.role === 'ADMIN' ? {} : { members: { some: { userId: params.userId } } }),
  };

  const [data, total] = await Promise.all([
    prisma.warehouse.findMany({ where, ...paginationArgs(params), orderBy: { createdAt: 'desc' } }),
    prisma.warehouse.count({ where }),
  ]);

  return { data, pagination: paginationMeta(params, total) };
}

export async function createWarehouse(
  input: CreateWarehouseInput,
  actor: { id: string; organizationId: string },
) {
  return prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name,
        address: input.address,
        createdById: actor.id,
      },
    });
    // Explicit membership even for the creator (an Admin), so "who is on
    // this warehouse" stays accurate without relying on the implicit
    // Admin-sees-everything rule in requireWarehouseAccess.
    await tx.warehouseMember.create({
      data: { warehouseId: warehouse.id, userId: actor.id, role: 'ADMIN' },
    });
    return warehouse;
  }).then((warehouse) => {
    writeAuditLog({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'WAREHOUSE_CREATED',
      entity: 'Warehouse',
      entityId: warehouse.id,
      newValue: warehouse,
    });
    return warehouse;
  });
}

export async function getWarehouse(id: string, organizationId: string) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw new AppError('NOT_FOUND', 'Warehouse not found');
  assertOrgScope(warehouse.organizationId, organizationId);
  return warehouse;
}

export async function updateWarehouse(
  id: string,
  organizationId: string,
  input: UpdateWarehouseInput,
  actorUserId: string,
) {
  const before = await getWarehouse(id, organizationId);
  const warehouse = await prisma.warehouse.update({ where: { id }, data: input });
  writeAuditLog({
    organizationId,
    userId: actorUserId,
    action: 'WAREHOUSE_UPDATED',
    entity: 'Warehouse',
    entityId: id,
    oldValue: before,
    newValue: warehouse,
  });
  return warehouse;
}

export async function deleteWarehouse(id: string, organizationId: string, actorUserId: string) {
  const warehouse = await getWarehouse(id, organizationId);
  // No cascade override for StockMovement/PurchaseOrder/SalesOrder
  // references - Postgres rejects the delete (FK violation -> 409) once a
  // warehouse has any stock/order history. Only an unused warehouse can
  // actually be deleted; that's deliberate, not a bug.
  await prisma.warehouse.delete({ where: { id } });
  writeAuditLog({
    organizationId,
    userId: actorUserId,
    action: 'WAREHOUSE_DELETED',
    entity: 'Warehouse',
    entityId: id,
    oldValue: warehouse,
  });
}

export async function addMember(warehouseId: string, organizationId: string, input: AddMemberInput) {
  await getWarehouse(warehouseId, organizationId);
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.organizationId !== organizationId) {
    throw new AppError('NOT_FOUND', 'User not found in this organization');
  }
  return prisma.warehouseMember.upsert({
    where: { warehouseId_userId: { warehouseId, userId: input.userId } },
    create: { warehouseId, userId: input.userId, role: input.role },
    update: { role: input.role },
  });
}

export async function removeMember(warehouseId: string, organizationId: string, userId: string) {
  await getWarehouse(warehouseId, organizationId);
  await prisma.warehouseMember.deleteMany({ where: { warehouseId, userId } });
}
