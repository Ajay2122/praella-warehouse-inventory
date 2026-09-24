import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../lib/errors';

// Coarse-grained check: does the user's org-wide role allow this action at
// all? (RBAC matrix in ARCHITECTURE.md section 3, layer 1.) Warehouse-scoped
// actions additionally go through requireWarehouseAccess/requireWarehouseRole
// (layer 2) for the ownership/membership check.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('UNAUTHENTICATED', 'Not authenticated'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', `Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}
