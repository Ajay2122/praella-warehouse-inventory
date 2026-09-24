import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 500, 3000),
  lazyConnect: true,
});

let loggedConnectionIssue = false;
redis.on('error', (err: Error) => {
  // Cache and jobs (lib/cache.ts, jobs/*) both treat Redis as best-effort -
  // a connection issue degrades to "skip the optimization, hit the DB /
  // run inline", never a request failure. Log once so it's visible without
  // spamming on every retry.
  if (!loggedConnectionIssue) {
    console.warn(`[redis] connection issue - caching and background jobs are degraded: ${err.message}`);
    loggedConnectionIssue = true;
  }
});

redis.connect().catch(() => {
  // handled by the 'error' listener above
});
