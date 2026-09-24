import type { MovementType } from '@prisma/client';

export interface BulkStockUpdateItem {
  productId: string;
  warehouseId: string;
  type: Extract<MovementType, 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT'>;
  direction?: 'IN' | 'OUT';
  quantity: number;
}

export interface BulkStockUpdateJobData {
  organizationId: string;
  actorUserId: string;
  items: BulkStockUpdateItem[];
}

export interface BulkStockUpdateLineResult {
  index: number;
  ok: boolean;
  error?: string;
}

export interface BulkStockUpdateResult {
  results: BulkStockUpdateLineResult[];
  succeeded: number;
  failed: number;
}
