import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { AppError } from '../lib/errors';

// Populates req.user from the JWT access token. Every route past this
// point trusts req.user.organizationId - the client-supplied body/query
// organizationId is never trusted (see ARCHITECTURE.md section 3).
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHENTICATED', 'Missing or invalid Authorization header'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, organizationId: payload.organizationId, role: payload.role };
    next();
  } catch {
    next(new AppError('UNAUTHENTICATED', 'Invalid or expired access token'));
  }
}
