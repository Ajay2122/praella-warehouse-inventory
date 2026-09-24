import { client } from '../helpers/testClient';
import { setupScenario, setStock, stockLevel } from '../helpers/fixtures';

describe('warehouse transfers', () => {
  it('moves stock atomically between two warehouses in one transaction', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 100);

    const res = await client
      .post('/api/transfers')
      .set(s.adminAuth)
      .send({ productId: s.product.id, fromWarehouseId: s.warehouseA.id, toWarehouseId: s.warehouseB.id, quantity: 20 });

    expect(res.status).toBe(201);
    expect(res.body.data.out.type).toBe('TRANSFER_OUT');
    expect(res.body.data.in.type).toBe('TRANSFER_IN');
    expect(res.body.data.out.referenceId).toBe(res.body.data.in.referenceId);
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(80);
    expect(await stockLevel(s.product.id, s.warehouseB.id)).toBe(20);
  });

  it('rejects a transfer larger than available stock and rolls back both legs (neither warehouse changes)', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 10);
    await setStock(s.product.id, s.warehouseB.id, 0);

    const res = await client
      .post('/api/transfers')
      .set(s.adminAuth)
      .send({ productId: s.product.id, fromWarehouseId: s.warehouseA.id, toWarehouseId: s.warehouseB.id, quantity: 500 });

    expect(res.status).toBe(422);
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(10);
    expect(await stockLevel(s.product.id, s.warehouseB.id)).toBe(0);
  });

  it('rejects a transfer where the destination warehouse does not exist / is not in the org', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 10);

    const res = await client
      .post('/api/transfers')
      .set(s.adminAuth)
      .send({ productId: s.product.id, fromWarehouseId: s.warehouseA.id, toWarehouseId: 'not-a-real-id', quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('Staff cannot transfer stock even between two warehouses they can view', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 10);

    const res = await client
      .post('/api/transfers')
      .set(s.staffAuth)
      .send({ productId: s.product.id, fromWarehouseId: s.warehouseA.id, toWarehouseId: s.warehouseB.id, quantity: 1 });

    expect(res.status).toBe(403);
  });
});

describe('concurrency: two simultaneous requests cannot jointly oversell', () => {
  it('exactly one of two concurrent 50-unit OUTBOUND requests against 80 units succeeds', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 80);

    const body = { productId: s.product.id, warehouseId: s.warehouseA.id, type: 'OUTBOUND', quantity: 50 };
    const [first, second] = await Promise.all([
      client.post('/api/stock/movements').set(s.adminAuth).send(body),
      client.post('/api/stock/movements').set(s.adminAuth).send(body),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 422]);
    // 80 - 50 = 30, never negative, never double-applied
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(30);
  });
});
