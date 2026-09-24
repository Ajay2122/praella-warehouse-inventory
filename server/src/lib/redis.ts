import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
  lazyConnect: true,
  // The critical setting for "fail open": ioredis's default (true) queues
  // commands in memory while disconnected and only rejects once the retry
  // budget above is exhausted - which made every cacheGetOrSet() call hang
  // for the full retry window instead of falling through to the DB
  // immediately, in exactly the no-Redis environment this fallback exists
  // for. false makes a command reject the instant it can't be sent.
  enableOfflineQueue: false,
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
