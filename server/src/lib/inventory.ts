import type { MovementType, Prisma, ReferenceType } from '@prisma/client';
import { AppError } from './errors';

export interface MovementInput {
  productId: string;
  type: MovementType;
  quantity: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  actorUserId: string;
  referenceType?: ReferenceType;
  referenceId?: string;
}

// Atomically adjusts a (product, warehouse) StockLevel by `delta` inside an
// existing transaction. Increments are a plain atomic +=. Decrements use a
// conditional UPDATE (`WHERE quantity >= amount`) rather than a
// read-then-write - that's what makes concurrent decrements safe: Postgres
// row-locks the StockLevel row for the duration of each UPDATE, so two
// concurrent decrements against the same row serialize, and the second one
// re-evaluates the WHERE clause against the first one's committed result
// instead of a stale value it read earlier. If the condition fails
// (insufficient stock, whether that was always true or became true because
// a concurrent request just consumed it), updateMany matches zero rows and
// we throw - never a negative quantity, never a lost update.
async function applyStockDelta(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  if (delta > 0) {
    await tx.stockLevel.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, quantity: delta },
      update: { quantity: { increment: delta } },
    });
    return;
  }

  const amount = -delta;
  const result = await tx.stockLevel.updateMany({
    where: { productId, warehouseId, quantity: { gte: amount } },
    data: { quantity: { decrement: amount } },
  });

  if (result.count === 0) {
    throw new AppError('INSUFFICIENT_STOCK', 'Insufficient stock for this operation');
  }
}

// The one function that ever writes a StockMovement row. Every stock
// change in the system - manual adjustment, transfer, PO receive, SO
// dispatch - goes through this, inside a $transaction the caller owns, so
// multi-line operations (an order with several products) commit or roll
// back as a single unit.
export async function applyMovement(tx: Prisma.TransactionClient, input: MovementInput) {
  if (input.quantity <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Movement quantity must be positive');
  }
  if (!input.fromWarehouseId && !input.toWarehouseId) {
    throw new AppError('VALIDATION_ERROR', 'Movement must specify fromWarehouseId and/or toWarehouseId');
  }

  if (input.fromWarehouseId) {
    await applyStockDelta(tx, input.productId, input.fromWarehouseId, -input.quantity);
  }
  if (input.toWarehouseId) {
    await applyStockDelta(tx, input.productId, input.toWarehouseId, input.quantity);
  }

  return tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      actorUserId: input.actorUserId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
  });
}
