import { z } from 'zod';

// Base query schema every paginated list endpoint extends. Kept generic
// (no warehouseId/category/etc here) so each module adds only the filters
// that make sense for it.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).optional(),
  sort: z.string().optional(),
});

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export function paginationArgs({ page, pageSize }: PaginationInput) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginationMeta({ page, pageSize }: PaginationInput, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
