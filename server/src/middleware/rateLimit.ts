import rateLimit from 'express-rate-limit';

// General API limiter: generous, just a backstop against runaway clients.
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

// Tighter limiter on auth endpoints specifically - these are the ones a
// credential-stuffing or brute-force attempt would hammer.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, try again later' } },
});
