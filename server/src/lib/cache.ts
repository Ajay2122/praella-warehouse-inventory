import crypto from 'crypto';
import { redis } from './redis';

const DEFAULT_TTL_SECONDS = 45;

// Cache-aside, not a generic ORM cache: callers pick the key and the
// invalidation trigger explicitly (see product.service.ts / stock.service.ts),
// so it's always obvious what a write needs to bust. Every Redis call is
// wrapped in try/catch - a cache miss-by-failure is indistinguishable from
// a cache miss-by-empty, and a failed cache write never fails the request.
export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // fall through to the DB
  }

  const value = await fetcher();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // best-effort
  }

  return value;
}

// KEYS is O(N) over the whole keyspace - fine at this scale/test scope, but
// a SCAN-based cursor loop is what you'd swap in for a production-sized
// Redis instance to avoid blocking it during invalidation.
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // best-effort
  }
}

export function hashQuery(obj: Record<string, unknown>): string {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

export const cacheKeys = {
  productList: (orgId: string, queryHash: string) => `product:list:${orgId}:${queryHash}`,
  productListPattern: (orgId: string) => `product:list:${orgId}:*`,
  stockLevels: (orgId: string, queryHash: string) => `stock:levels:${orgId}:${queryHash}`,
  stockLevelsPattern: (orgId: string) => `stock:levels:${orgId}:*`,
  replenishmentAlertsPattern: (orgId: string) => `replenishment:alerts:${orgId}:*`,
};

// Any stock-changing operation (movement, transfer, PO receive, SO
// dispatch) invalidates both caches together - a stale StockLevel and a
// stale low-stock alert are the same underlying staleness.
export async function invalidateInventoryCaches(organizationId: string): Promise<void> {
  await Promise.all([
    cacheInvalidate(cacheKeys.stockLevelsPattern(organizationId)),
    cacheInvalidate(cacheKeys.replenishmentAlertsPattern(organizationId)),
  ]);
}
