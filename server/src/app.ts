import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './lib/prisma';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { warehouseRouter } from './modules/warehouses/warehouse.routes';
import { categoryRouter } from './modules/products/category.routes';
import { supplierRouter } from './modules/products/supplier.routes';
import { productRouter } from './modules/products/product.routes';
import { replenishmentRouter, stockRouter, transferRouter } from './modules/stock/stock.routes';
import { purchaseOrderRouter } from './modules/orders/purchaseOrder.routes';
import { salesOrderRouter } from './modules/orders/salesOrder.routes';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// Liveness: process is up. No dependency checks.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Readiness: process is up AND its dependencies (DB, ...) are reachable.
app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', error: (err as Error).message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/warehouses', warehouseRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/products', productRouter);
app.use('/api/stock', stockRouter);
app.use('/api/transfers', transferRouter);
app.use('/api/replenishment-rules', replenishmentRouter);
app.use('/api/purchase-orders', purchaseOrderRouter);
app.use('/api/sales-orders', salesOrderRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

app.use(errorHandler);
