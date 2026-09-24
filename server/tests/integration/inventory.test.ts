import { client } from '../helpers/testClient';
import { setupScenario, setStock, stockLevel } from '../helpers/fixtures';

describe('stock movements: increase/decrease, insufficient stock, RBAC', () => {
  it('an INBOUND movement increases stock and is recorded on the ledger', async () => {
    const s = await setupScenario();

    const res = await client
      .post('/api/stock/movements')
      .set(s.staffAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, type: 'INBOUND', quantity: 30 });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('INBOUND');
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(30);
  });

  it('an OUTBOUND movement decreases stock; Staff is allowed to record it', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 20);

    const res = await client
      .post('/api/stock/movements')
      .set(s.staffAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, type: 'OUTBOUND', quantity: 5 });

    expect(res.status).toBe(201);
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(15);
  });

  it('rejects an OUTBOUND movement larger than current stock, and stock is unchanged', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 10);

    const res = await client
      .post('/api/stock/movements')
      .set(s.staffAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, type: 'OUTBOUND', quantity: 11 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(10);
  });

  it('never allows quantity to go negative, even at exactly zero remaining', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 5);

    const exact = await client
      .post('/api/stock/movements')
      .set(s.staffAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, type: 'OUTBOUND', quantity: 5 });
    const oneMore = await client
      .post('/api/stock/movements')
      .set(s.staffAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, type: 'OUTBOUND', quantity: 1 });

    expect(exact.status).toBe(201);
    expect(oneMore.status).toBe(422);
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(0);
  });

  it('Staff cannot record an ADJUSTMENT (only Admin/Manager can); Staff can record INBOUND/OUTBOUND', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 10);

    const staffAdjustment = await client
      .post('/api/stock/movements')
      .set(s.staffAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, type: 'ADJUSTMENT', direction: 'OUT', quantity: 1 });
    const managerAdjustment = await client
      .post('/api/stock/movements')
      .set(s.managerAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, type: 'ADJUSTMENT', direction: 'OUT', quantity: 1 });

    expect(staffAdjustment.status).toBe(403);
    expect(managerAdjustment.status).toBe(201);
  });

  it('rejects a movement against a warehouse the caller is not a member of', async () => {
    const s = await setupScenario();

    const res = await client
      .post('/api/stock/movements')
      .set(s.staffAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseB.id, type: 'INBOUND', quantity: 5 });

    expect(res.status).toBe(403);
  });

  it('GET /api/replenishment-rules/alerts flags a product below its threshold', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 3);
    await client
      .put('/api/replenishment-rules')
      .set(s.adminAuth)
      .send({ productId: s.product.id, warehouseId: s.warehouseA.id, minThreshold: 10 });

    const res = await client.get('/api/replenishment-rules/alerts').set(s.adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { product: { id: string } }) => a.product.id === s.product.id)).toBe(true);
  });
});
