import type { Request, Response } from 'express';
import * as poService from './purchaseOrder.service';

export async function createHandler(req: Request, res: Response) {
  const po = await poService.createPurchaseOrder(req.body, req.user!);
  res.status(201).json({ success: true, data: po });
}

export async function listHandler(req: Request, res: Response) {
  const { page, pageSize, warehouseId, status } = req.query as unknown as {
    page: number;
    pageSize: number;
    warehouseId?: string;
    status?: string;
  };
  const result = await poService.listPurchaseOrders({ page, pageSize, warehouseId, status, user: req.user! });
  res.json({ success: true, ...result });
}

export async function getHandler(req: Request, res: Response) {
  const po = await poService.getPurchaseOrder(req.params.id as string, req.user!.organizationId);
  res.json({ success: true, data: po });
}

export async function confirmHandler(req: Request, res: Response) {
  const po = await poService.confirmPurchaseOrder(req.params.id as string, req.user!);
  res.json({ success: true, data: po });
}

export async function receiveHandler(req: Request, res: Response) {
  const po = await poService.receivePurchaseOrder(req.params.id as string, req.user!);
  res.json({ success: true, data: po });
}

export async function cancelHandler(req: Request, res: Response) {
  const po = await poService.cancelPurchaseOrder(req.params.id as string, req.user!);
  res.json({ success: true, data: po });
}
