import type { Request, Response } from 'express';
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

export async function upsertReplenishmentRuleHandler(req: Request, res: Response) {
  const rule = await stockService.upsertReplenishmentRule(req.body, req.user!);
  res.json({ success: true, data: rule });
}

export async function lowStockAlertsHandler(req: Request, res: Response) {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await stockService.listLowStockAlerts(req.user!, { page, pageSize });
  res.json({ success: true, ...result });
}
