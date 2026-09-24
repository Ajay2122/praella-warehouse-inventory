import type { Request, Response } from 'express';
import * as productService from './product.service';

export async function listHandler(req: Request, res: Response) {
  const { page, pageSize, search, categoryId, warehouseId } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
    categoryId?: string;
    warehouseId?: string;
  };
  const result = await productService.listProducts({
    page,
    pageSize,
    search,
    categoryId,
    warehouseId,
    organizationId: req.user!.organizationId,
  });
  res.json({ success: true, ...result });
}

export async function createHandler(req: Request, res: Response) {
  const product = await productService.createProduct(req.body, req.user!.organizationId, req.user!.id);
  res.status(201).json({ success: true, data: product });
}

export async function getHandler(req: Request, res: Response) {
  const product = await productService.getProduct(req.params.id as string, req.user!.organizationId);
  res.json({ success: true, data: product });
}

export async function updateHandler(req: Request, res: Response) {
  const product = await productService.updateProduct(
    req.params.id as string,
    req.user!.organizationId,
    req.body,
    req.user!.id,
  );
  res.json({ success: true, data: product });
}

export async function deleteHandler(req: Request, res: Response) {
  await productService.deleteProduct(req.params.id as string, req.user!.organizationId, req.user!.id);
  res.status(204).send();
}
