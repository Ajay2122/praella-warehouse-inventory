import { prisma } from '../src/lib/prisma';

// Runs once per test file after its suite finishes. Safe even though the
// Prisma client is a process-wide singleton shared across files (see
// lib/prisma.ts) - Prisma reconnects lazily on the next query if another
// file needs it afterward.
afterAll(async () => {
  await prisma.$disconnect();
});
