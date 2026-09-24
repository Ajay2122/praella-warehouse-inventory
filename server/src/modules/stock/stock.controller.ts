import type { Request, Response } from 'express';
import { AppError } from '../../lib/errors';
import { bulkStockUpdateQueue } from '../../jobs/queue';
import * as stockService from './stock.service';

export async function listLevelsHandler(req: Request, res: Response) {
  const { page, pageSize, warehouseId, productId } = req.query as unknown as {
    page: number;
    pageSize: number;
    warehouseId?: string;
    productId?: string;
  };
  const result = await stockService.listStockLevels({ page, pageSize, warehouseId, productId, user: req.user! });
  res.json({ success: true, ...result });
}

export async function listMovementsHandler(req: Request, res: Response) {
  const { page, pageSize, warehouseId, productId, type, from, to } = req.query as unknown as {
    page: number;
    pageSize: number;
    warehouseId?: string;
    productId?: string;
    type?: string;
    from?: Date;
    to?: Date;
  };
  const result = await stockService.listMovements({
    page,
    pageSize,
    warehouseId,
    productId,
    type,
    from,
    to,
    user: req.user!,
  });
  res.json({ success: true, ...result });
}

export async function recordMovementHandler(req: Request, res: Response) {
  const movement = await stockService.recordMovement(req.body, req.user!);
  res.status(201).json({ success: true, data: movement });
}

export async function transferHandler(req: Request, res: Response) {
  const result = await stockService.transferStock(req.body, req.user!);
  res.status(201).json({ success: true, data: result });
}

export async function listTransfersHandler(req: Request, res: Response) {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await stockService.listTransfers({ page, pageSize, user: req.user! });
  res.json({ success: true, ...result });
}

// Enqueues and returns immediately with a jobId - RBAC is checked once
// here at enqueue time (Admin/Manager only), not re-checked per item by
// the worker, which trusts organizationId/actorUserId captured on the job.
export async function bulkUpdateHandler(req: Request, res: Response) {
  const job = await bulkStockUpdateQueue.add('bulk-update', {
    organizationId: req.user!.organizationId,
    actorUserId: req.user!.id,
    items: req.body.items,
  });
  res.status(202).json({ success: true, data: { jobId: job.id } });
}

export async function bulkUpdateStatusHandler(req: Request, res: Response) {
  const job = await bulkStockUpdateQueue.getJob(req.params.jobId as string);
  if (!job) throw new AppError('NOT_FOUND', 'Job not found');
  const state = await job.getState();
  res.json({
    success: true,
    data: { id: job.id, state, progress: job.progress, result: job.returnvalue ?? null },
  });
}

export async function upsertReplenishmentRuleHandler(req: Request, res: Response) {
  const rule = await stockService.upsertReplenishmentRule(req.body, req.user!);
  res.json({ success: true, data: rule });
}

export async function lowStockAlertsHandler(req: Request, res: Response) {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await stockService.listLowStockAlerts(req.user!, { page, pageSize });
  res.json({ success: true, ...result });
}
