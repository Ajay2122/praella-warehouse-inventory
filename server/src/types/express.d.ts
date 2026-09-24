import type { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: Role;
}

export interface WarehouseMembership {
  warehouseId: string;
  role: Role | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      warehouseMembership?: WarehouseMembership;
    }
  }
}

export {};
