import { Worker, type Job } from 'bullmq';
import { bullConnection, QUEUE_NAMES } from './queue';
import { prisma } from '../lib/prisma';
import { applyMovement } from '../lib/inventory';
import { invalidateInventoryCaches } from '../lib/cache';
import type { BulkStockUpdateJobData, BulkStockUpdateResult } from './types';

// Large stock imports (e.g. a CSV upload) go through here instead of the
// synchronous POST /api/stock/movements path, so the HTTP request returns
// immediately with a jobId rather than holding the connection open for
// potentially thousands of rows. Each line is its OWN transaction (unlike
// order receive/dispatch, where all lines must succeed or none do) - a bulk
// import is a best-effort batch, so one bad row shouldn't sink the other
// rows; failures are reported per-line in the job result instead.
export const bulkStockUpdateWorker = new Worker<BulkStockUpdateJobData, BulkStockUpdateResult>(
  QUEUE_NAMES.bulkStockUpdate,
  async (job: Job<BulkStockUpdateJobData>) => {
    const { organizationId, actorUserId, items } = job.data;
    const results: BulkStockUpdateResult['results'] = [];

    for (const [index, item] of items.entries()) {
      try {
        const direction = item.type === 'INBOUND' ? 'IN' : item.type === 'OUTBOUND' ? 'OUT' : item.direction;
        await prisma.$transaction((tx) =>
          applyMovement(tx, {
            productId: item.productId,
            type: item.type,
            quantity: item.quantity,
            toWarehouseId: direction === 'IN' ? item.warehouseId : undefined,
            fromWarehouseId: direction === 'OUT' ? item.warehouseId : undefined,
            actorUserId,
            referenceType: 'MANUAL',
          }),
        );
        results.push({ index, ok: true });
      } catch (err) {
        results.push({ index, ok: false, error: (err as Error).message });
      }
      await job.updateProgress(Math.round(((index + 1) / items.length) * 100));
    }

    await invalidateInventoryCaches(organizationId);

    return {
      results,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    };
  },
  { connection: bullConnection, autorun: false },
);

bulkStockUpdateWorker.on('error', (err) => {
  console.warn('[jobs] bulkStockUpdate worker error (Redis likely unavailable):', err.message);
});
