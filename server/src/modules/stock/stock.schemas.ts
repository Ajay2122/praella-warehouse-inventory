import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

export const recordMovementSchema = z
  .object({
    productId: z.string().min(1),
    warehouseId: z.string().min(1),
    type: z.enum(['INBOUND', 'OUTBOUND', 'ADJUSTMENT']),
    quantity: z.coerce.number().int().positive(),
    // Only meaningful (and required) for ADJUSTMENT - INBOUND/OUTBOUND
    // imply their own direction.
    direction: z.enum(['IN', 'OUT']).optional(),
  })
  .refine((data) => data.type !== 'ADJUSTMENT' || !!data.direction, {
    message: 'direction ("IN" or "OUT") is required for ADJUSTMENT movements',
    path: ['direction'],
  });
export type RecordMovementInput = z.infer<typeof recordMovementSchema>;

export const listStockLevelsQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
});

export const listMovementsQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  type: z.enum(['INBOUND', 'OUTBOUND', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const transferSchema = z
  .object({
    productId: z.string().min(1),
    fromWarehouseId: z.string().min(1),
    toWarehouseId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'fromWarehouseId and toWarehouseId must differ',
    path: ['toWarehouseId'],
  });
export type TransferInput = z.infer<typeof transferSchema>;

export const listTransfersQuerySchema = paginationQuerySchema;

export const upsertReplenishmentRuleSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  minThreshold: z.coerce.number().int().nonnegative(),
});
export type UpsertReplenishmentRuleInput = z.infer<typeof upsertReplenishmentRuleSchema>;
