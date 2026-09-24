import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().min(1),
  supplierId: z.string().min(1),
  unitPrice: z.coerce.number().positive(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// warehouseId, when given, scopes the list to products actually stocked in
// that warehouse and includes that warehouse's quantity in the response.
export const listProductsQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().min(1).optional(),
  warehouseId: z.string().min(1).optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productIdParamSchema = z.object({ id: z.string().min(1) });
