import type { NextFunction, Request, Response } from 'express';

// Minimal structured-ish request log - deliberately not a logging
// framework (Winston/Pino) for something this small; stdout + a process
// manager or platform log collector is enough at this scope.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      `[req] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms` +
        (req.user ? ` user=${req.user.id}` : ''),
    );
  });
  next();
}
