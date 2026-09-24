import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { env } from '../config/env';

// BullMQ requires its own connection with maxRetriesPerRequest: null -
// distinct from lib/redis.ts's cache client, which intentionally retries
// only once so a slow cache never blocks a request. Job durability has
// different tradeoffs than a cache read.
//
// retryStrategy is bounded (unlike a typical production setting) so that
// an environment with no Redis at all - e.g. this project's test suite -
// fails fast instead of reconnecting forever and spamming a fresh
// AggregateError stack on every attempt.
export const bullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
});

bullConnection.on('error', () => {
  // Workers log their own connection warnings (see jobs/index.ts) - avoid
  // duplicate noise here.
});

export const QUEUE_NAMES = {
  bulkStockUpdate: 'stock.bulkUpdate',
  replenishmentScan: 'replenishment.scan',
} as const;

export const bulkStockUpdateQueue = new Queue(QUEUE_NAMES.bulkStockUpdate, { connection: bullConnection });
export const replenishmentScanQueue = new Queue(QUEUE_NAMES.replenishmentScan, { connection: bullConnection });

// Queue itself re-emits connection errors as its own 'error' event; with no
// listener, Node's EventEmitter throws instead of just logging. These are
// deliberately silent - bullConnection's listener above already covers the
// operator-facing warning.
bulkStockUpdateQueue.on('error', () => {});
replenishmentScanQueue.on('error', () => {});
