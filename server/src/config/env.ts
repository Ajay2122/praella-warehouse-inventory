import 'dotenv/config';
import { z } from 'zod';

// Only Phase 1's variables are validated here. Later phases (auth, Redis, ...)
// extend this schema when they introduce their own required env vars - we don't
// pre-declare vars nothing reads yet.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
