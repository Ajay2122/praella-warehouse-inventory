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

const nameSchema = z.object({ name: z.string().trim().min(1).max(120) });
const idParamSchema = z.object({ id: z.string().min(1) });

export const categoryRouter = Router();
categoryRouter.use(requireAuth);

categoryRouter.get(
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
      prisma.category.findMany({ where, ...paginationArgs({ page, pageSize }), orderBy: { name: 'asc' } }),
      prisma.category.count({ where }),
    ]);
    res.json({ success: true, data, pagination: paginationMeta({ page, pageSize }, total) });
  }),
);

categoryRouter.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  validate({ body: nameSchema }),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({
      data: { organizationId: req.user!.organizationId, name: req.body.name },
    });
    res.status(201).json({ success: true, data: category });
  }),
);

categoryRouter.patch(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate({ params: idParamSchema, body: nameSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('NOT_FOUND', 'Category not found');
    assertOrgScope(existing.organizationId, req.user!.organizationId);
    const category = await prisma.category.update({ where: { id: existing.id }, data: { name: req.body.name } });
    res.json({ success: true, data: category });
  }),
);

categoryRouter.delete(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('NOT_FOUND', 'Category not found');
    assertOrgScope(existing.organizationId, req.user!.organizationId);
    await prisma.category.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);
