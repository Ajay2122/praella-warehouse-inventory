import { bulkStockUpdateWorker } from './bulkStockUpdate.worker';
import { replenishmentScanWorker, scheduleReplenishmentScan } from './replenishmentScan.worker';

export { bulkStockUpdateQueue } from './queue';

// Called once from server.ts, never from app.ts - app.ts is also imported
// by Jest/Supertest tests, which shouldn't spin up real BullMQ workers or
// a repeatable scheduled job as a side effect of importing the app.
export async function startJobs(): Promise<void> {
  bulkStockUpdateWorker.run();
  replenishmentScanWorker.run();
  await scheduleReplenishmentScan();
}
