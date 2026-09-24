import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { asyncHandler } from '../../lib/asyncHandler';

export const userRouter = Router();
userRouter.use(requireAuth);

// Admin-only, per the RBAC matrix ("view org users / manage roles").
// Deliberately unpaginated - org headcount is small at this scope, and
// this exists mainly to populate a user picker in the client, not as a
// bulk-data endpoint.
userRouter.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
    res.json({ success: true, data: users });
  }),
);
