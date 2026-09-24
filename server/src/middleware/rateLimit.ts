import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Rate limiting exists to blunt real abuse (credential stuffing, runaway
// clients) - it isn't something the automated test suite should have to
// work around. This project's own tests found the auth limiter tripping
// mid-run (dozens of logins across ~30 integration tests, well under any
// real brute-force volume but over 20/15min), so it's a no-op skip in
// NODE_ENV=test rather than a raised-but-still-guessable threshold.
const isTest = env.NODE_ENV === 'test';

// General API limiter: generous, just a backstop against runaway clients.
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

// Tighter limiter on auth endpoints specifically - these are the ones a
// credential-stuffing or brute-force attempt would hammer.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, try again later' } },
});
