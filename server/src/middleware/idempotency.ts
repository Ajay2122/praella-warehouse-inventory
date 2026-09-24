import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../lib/asyncHandler';

// Protects state-changing endpoints (PO receive, SO dispatch, transfers)
// from duplicate submission. Opt-in via an `Idempotency-Key` header: a
// repeat request with the same key (and the same body) short-circuits to
// the stored response instead of re-running the operation. This is a
// second line of defense - the primary one is that receive/dispatch check
// order status themselves (CONFIRMED -> RECEIVED is a one-way transition,
// so a duplicate call fails the status check even without a key).
export function idempotent() {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('Idempotency-Key');
    if (!key) return next();

    const organizationId = req.user!.organizationId;
    const requestHash = crypto
      .createHash('sha256')
      .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`)
      .digest('hex');

    const existing = await prisma.idempotencyKey.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError('CONFLICT', 'Idempotency-Key was already used with a different request');
      }
      res.status(existing.responseStatus).json(existing.responseBody);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      // Only memoize success - a 4xx (e.g. "wrong status to receive from")
      // must stay retryable with the same key once the client fixes
      // whatever caused it, otherwise a bad first attempt would poison the
      // key forever. Only a completed 2xx actually did the side effect
      // that duplication would double-apply.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        prisma.idempotencyKey
          .create({
            data: {
              organizationId,
              key,
              requestHash,
              responseStatus: res.statusCode,
              responseBody: body as Prisma.InputJsonValue,
            },
          })
          .catch((err) => console.error('[idempotency] failed to persist response', err));
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  });
}
