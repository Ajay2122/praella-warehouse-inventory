import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { assertOrgScope } from '../../lib/orgScope';
import { paginationArgs, paginationMeta, paginationQuerySchema } from '../../lib/pagination';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';

const supplierBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  contactEmail: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).optional(),
});
const idParamSchema = z.object({ id: z.string().min(1) });

export const supplierRouter = Router();
supplierRouter.use(requireAuth);

supplierRouter.get(
  '/',
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
    };
    const where = {
      organizationId: req.user!.organizationId,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, ...paginationArgs({ page, pageSize }), orderBy: { name: 'asc' } }),
      prisma.supplier.count({ where }),
    ]);
    res.json({ success: true, data, pagination: paginationMeta({ page, pageSize }, total) });
  }),
);

supplierRouter.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  validate({ body: supplierBodySchema }),
  asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.create({
      data: { organizationId: req.user!.organizationId, ...req.body },
    });
    res.status(201).json({ success: true, data: supplier });
  }),
);

supplierRouter.patch(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate({ params: idParamSchema, body: supplierBodySchema.partial() }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('NOT_FOUND', 'Supplier not found');
    assertOrgScope(existing.organizationId, req.user!.organizationId);
    const supplier = await prisma.supplier.update({ where: { id: existing.id }, data: req.body });
    res.json({ success: true, data: supplier });
  }),
);

supplierRouter.delete(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('NOT_FOUND', 'Supplier not found');
    assertOrgScope(existing.organizationId, req.user!.organizationId);
    await prisma.supplier.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);
