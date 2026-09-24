import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { env } from '../config/env';

// BullMQ requires its own connection with maxRetriesPerRequest: null -
// distinct from lib/redis.ts's cache client, which intentionally retries
// only once so a slow cache never blocks a request. Job durability has
// different tradeoffs than a cache read.
export const bullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
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
