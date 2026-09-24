import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

// Runs once, before any test file. Pushes the current schema straight onto
// the test database (no --force-reset: that flag drops and recreates the
// whole database, which Prisma's CLI itself refuses to let an AI agent run
// without a human explicitly re-confirming per command). A plain `db push`
// is additive/idempotent - safe to run every time - and is enough here
// because every test fixture (see tests/helpers/fixtures.ts) generates
// unique emails/SKUs/names per run, so leftover rows from a previous run
// never collide with a new one.
export default async function globalSetup(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

  execSync('npx prisma db push --skip-generate', {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
}
