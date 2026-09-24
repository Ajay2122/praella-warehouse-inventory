import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../lib/asyncHandler';
import { effectiveWarehouseRole, resolveWarehouseAccess } from '../lib/warehouseAccess';

export { effectiveWarehouseRole };

// Route middleware form of resolveWarehouseAccess: reads the warehouse id
// from req.params[paramName] and attaches the resolved membership to
// req.warehouseMembership for requireWarehouseRole / controllers to reuse.
export function requireWarehouseAccess(paramName = 'id') {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const warehouseId = req.params[paramName];
    if (!warehouseId) throw new AppError('NOT_FOUND', 'Warehouse not found');

    const { membership } = await resolveWarehouseAccess(warehouseId, req.user!);
    req.warehouseMembership = { warehouseId, role: membership?.role ?? null };
    next();
  });
}

// Fine-grained check within a warehouse, e.g. Staff can record a movement
// but not delete one. Must run after requireWarehouseAccess.
export function requireWarehouseRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = effectiveWarehouseRole(req.user!, req.warehouseMembership);
    if (!roles.includes(role)) {
      return next(new AppError('FORBIDDEN', `Requires warehouse role: ${roles.join(' or ')}`));
    }
    next();
  };
}
