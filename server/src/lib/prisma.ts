import { PrismaClient } from '@prisma/client';

// Singleton so dev hot-reload (tsx watch) doesn't open a new connection pool
// on every file save.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}
