import type { Request, Response } from 'express';
import * as soService from './salesOrder.service';

export async function createHandler(req: Request, res: Response) {
  const so = await soService.createSalesOrder(req.body, req.user!);
  res.status(201).json({ success: true, data: so });
}

export async function listHandler(req: Request, res: Response) {
  const { page, pageSize, warehouseId, status } = req.query as unknown as {
    page: number;
    pageSize: number;
    warehouseId?: string;
    status?: string;
  };
  const result = await soService.listSalesOrders({ page, pageSize, warehouseId, status, user: req.user! });
  res.json({ success: true, ...result });
}

export async function getHandler(req: Request, res: Response) {
  const so = await soService.getSalesOrder(req.params.id as string, req.user!.organizationId);
  res.json({ success: true, data: so });
}

export async function confirmHandler(req: Request, res: Response) {
  const so = await soService.confirmSalesOrder(req.params.id as string, req.user!);
  res.json({ success: true, data: so });
}

export async function dispatchHandler(req: Request, res: Response) {
  const so = await soService.dispatchSalesOrder(req.params.id as string, req.user!);
  res.json({ success: true, data: so });
}

export async function cancelHandler(req: Request, res: Response) {
  const so = await soService.cancelSalesOrder(req.params.id as string, req.user!);
  res.json({ success: true, data: so });
}
