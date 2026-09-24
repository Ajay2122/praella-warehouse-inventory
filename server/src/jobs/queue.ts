import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { env } from '../config/env';

// Two separate connections, not one shared: Queue.add() (called from a
// request handler - see stock.controller.ts) must fail fast if Redis is
// unreachable, so it uses bounded retries + enableOfflineQueue: false,
// same reasoning as lib/redis.ts's cache client. Workers, by contrast,
// hold a long-lived blocking read (BRPOPLPUSH-style) waiting for jobs, and
// BullMQ requires maxRetriesPerRequest: null for that connection - which
// would make a Queue.add() on the same connection queue forever instead
// of rejecting when Redis is down. Giving each its own connection with the
// settings it actually needs avoids that cross-contamination.
export const queueConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
  lazyConnect: true,
  enableOfflineQueue: false,
});

export const workerConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
  lazyConnect: true,
});

for (const conn of [queueConnection, workerConnection]) {
  conn.on('error', () => {
    // Workers log their own operator-facing warning (see jobs/index.ts);
    // this listener's only job is to stop ioredis's default unhandled
    // 'error' behavior from throwing.
  });
}

export const QUEUE_NAMES = {
  bulkStockUpdate: 'stock.bulkUpdate',
  replenishmentScan: 'replenishment.scan',
} as const;

export const bulkStockUpdateQueue = new Queue(QUEUE_NAMES.bulkStockUpdate, { connection: queueConnection });
export const replenishmentScanQueue = new Queue(QUEUE_NAMES.replenishmentScan, { connection: queueConnection });

bulkStockUpdateQueue.on('error', () => {});
replenishmentScanQueue.on('error', () => {});
