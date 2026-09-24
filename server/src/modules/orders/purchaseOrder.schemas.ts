import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative(),
});

export const createPurchaseOrderSchema = z.object({
  warehouseId: z.string().min(1),
  supplierId: z.string().min(1),
  lines: z.array(lineSchema).min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const listPurchaseOrdersQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']).optional(),
});

export const purchaseOrderIdParamSchema = z.object({ id: z.string().min(1) });
