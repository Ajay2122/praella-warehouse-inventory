import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

export const createSalesOrderSchema = z.object({
  warehouseId: z.string().min(1),
  lines: z.array(lineSchema).min(1),
});
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;

export const listSalesOrdersQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'DISPATCHED', 'CANCELLED']).optional(),
});

export const salesOrderIdParamSchema = z.object({ id: z.string().min(1) });
