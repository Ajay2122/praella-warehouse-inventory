import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import * as authService from './auth.service';

export async function signupHandler(req: Request, res: Response) {
  const result = await authService.signup(req.body);
  res.status(201).json({ success: true, data: result });
}

export async function loginHandler(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
}

export async function refreshHandler(req: Request, res: Response) {
  const result = await authService.refresh(req.body.refreshToken);
  res.json({ success: true, data: result });
}

export async function logoutHandler(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
}

export async function meHandler(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found');
  res.json({
    success: true,
    data: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
  });
}
