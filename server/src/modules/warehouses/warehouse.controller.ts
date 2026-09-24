import type { Request, Response } from 'express';
import * as warehouseService from './warehouse.service';

export async function listHandler(req: Request, res: Response) {
  const { page, pageSize, search } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
  };
  const result = await warehouseService.listWarehouses({
    page,
    pageSize,
    search,
    organizationId: req.user!.organizationId,
    userId: req.user!.id,
    role: req.user!.role,
  });
  res.json({ success: true, ...result });
}

export async function createHandler(req: Request, res: Response) {
  const warehouse = await warehouseService.createWarehouse(req.body, req.user!);
  res.status(201).json({ success: true, data: warehouse });
}

export async function getHandler(req: Request, res: Response) {
  const warehouse = await warehouseService.getWarehouse(req.params.id as string, req.user!.organizationId);
  res.json({ success: true, data: warehouse });
}

export async function updateHandler(req: Request, res: Response) {
  const warehouse = await warehouseService.updateWarehouse(
    req.params.id as string,
    req.user!.organizationId,
    req.body,
  );
  res.json({ success: true, data: warehouse });
}

export async function deleteHandler(req: Request, res: Response) {
  await warehouseService.deleteWarehouse(req.params.id as string, req.user!.organizationId);
  res.status(204).send();
}

export async function addMemberHandler(req: Request, res: Response) {
  const member = await warehouseService.addMember(
    req.params.id as string,
    req.user!.organizationId,
    req.body,
  );
  res.status(201).json({ success: true, data: member });
}

export async function removeMemberHandler(req: Request, res: Response) {
  await warehouseService.removeMember(
    req.params.id as string,
    req.user!.organizationId,
    req.params.userId as string,
  );
  res.status(204).send();
}
