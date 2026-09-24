import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './lib/prisma';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Liveness: process is up. No dependency checks.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Readiness: process is up AND its dependencies (DB, ...) are reachable.
// Split from /health so an orchestrator can restart on liveness failure but
// only stop routing traffic (not restart) on readiness failure.
app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', error: (err as Error).message });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Placeholder catch-all - Phase 13 replaces this with the full centralized
// error-handling contract (error codes, status mapping, logging).
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
});
