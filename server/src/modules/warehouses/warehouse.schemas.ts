import { z } from 'zod';
import { Role } from '@prisma/client';
import { paginationQuerySchema } from '../../lib/pagination';

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(255).optional(),
});
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

export const updateWarehouseSchema = createWarehouseSchema.partial();
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

export const listWarehousesQuerySchema = paginationQuerySchema;

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role).optional(),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const warehouseIdParamSchema = z.object({ id: z.string().min(1) });
export const warehouseMemberParamSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});
