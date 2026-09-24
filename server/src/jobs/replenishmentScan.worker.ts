import { Worker } from 'bullmq';
import { bullConnection, QUEUE_NAMES, replenishmentScanQueue } from './queue';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { computeLowStockAlerts, replenishmentAlertsCacheKey } from '../modules/stock/stock.service';

const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const CACHE_TTL_SECONDS = 20 * 60;

// Runs every 15 minutes (see scheduleReplenishmentScan below) and
// pre-warms the org-wide ("all warehouses", i.e. what an Admin sees) low-
// stock alert cache for every organization, so GET /api/replenishment-
// rules/alerts is usually served from cache rather than recomputed per
// request. Non-admin (per-warehouse) views are cached on-demand instead -
// see stock.service.ts's listLowStockAlerts.
export const replenishmentScanWorker = new Worker(
  QUEUE_NAMES.replenishmentScan,
  async () => {
    const organizations = await prisma.organization.findMany({ select: { id: true } });
    let totalAlerts = 0;

    for (const org of organizations) {
      const alerts = await computeLowStockAlerts({ id: '', organizationId: org.id, role: 'ADMIN' });
      totalAlerts += alerts.length;
      await redis
        .set(replenishmentAlertsCacheKey(org.id, 'all'), JSON.stringify(alerts), 'EX', CACHE_TTL_SECONDS)
        .catch(() => {
          // best-effort - a failed cache warm just means the next request
          // recomputes it live instead
        });
    }

    return { organizationsScanned: organizations.length, totalAlerts };
  },
  { connection: bullConnection, autorun: false },
);

replenishmentScanWorker.on('error', (err) => {
  console.warn('[jobs] replenishmentScan worker error (Redis likely unavailable):', err.message);
});

export async function scheduleReplenishmentScan(): Promise<void> {
  try {
    // BullMQ v6's repeatable-job API: upsertJobScheduler is idempotent (an
    // existing scheduler with this id is updated in place), so calling this
    // on every server start doesn't create duplicate repeating jobs.
    await replenishmentScanQueue.upsertJobScheduler(
      'replenishment-scan-repeatable',
      { every: SCAN_INTERVAL_MS },
      { name: 'scan' },
    );
  } catch (err) {
    console.warn(
      '[jobs] failed to schedule replenishment scan (Redis likely unavailable):',
      (err as Error).message,
    );
  }
}
