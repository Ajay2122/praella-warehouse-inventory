import type { Role, WarehouseMember } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from './errors';
import type { AuthenticatedUser } from '../types/express';

// Core check reused by both the requireWarehouseAccess route middleware
// (warehouseId from req.params) and services that receive a warehouseId
// from the request body (stock movements, transfers, orders).
export async function resolveWarehouseAccess(warehouseId: string, user: AuthenticatedUser) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse || warehouse.organizationId !== user.organizationId) {
    throw new AppError('NOT_FOUND', 'Warehouse not found');
  }

  const membership = await prisma.warehouseMember.findUnique({
    where: { warehouseId_userId: { warehouseId, userId: user.id } },
  });

  if (!membership && user.role !== 'ADMIN') {
    throw new AppError('FORBIDDEN', 'You do not have access to this warehouse');
  }

  return { warehouse, membership };
}

export function effectiveWarehouseRole(
  user: { role: Role },
  membership?: Pick<WarehouseMember, 'role'> | null,
): Role {
  return membership?.role ?? user.role;
}
