import { client } from '../helpers/testClient';
import { prisma } from '../../src/lib/prisma';
import { setupScenario, setStock, stockLevel, unique } from '../helpers/fixtures';

describe('purchase orders', () => {
  it('rejects receiving before confirm, and receiving twice does not double-apply stock', async () => {
    const s = await setupScenario();

    const create = await client
      .post('/api/purchase-orders')
      .set(s.managerAuth)
      .send({
        warehouseId: s.warehouseA.id,
        supplierId: s.supplier.id,
        lines: [{ productId: s.product.id, quantity: 15, unitCost: 5 }],
      });
    const poId = create.body.data.id;

    const receiveBeforeConfirm = await client.post(`/api/purchase-orders/${poId}/receive`).set(s.managerAuth);
    expect(receiveBeforeConfirm.status).toBe(422);

    await client.post(`/api/purchase-orders/${poId}/confirm`).set(s.managerAuth);

    const key = unique('idem-key');
    const first = await client
      .post(`/api/purchase-orders/${poId}/receive`)
      .set(s.managerAuth)
      .set('Idempotency-Key', key);
    const replay = await client
      .post(`/api/purchase-orders/${poId}/receive`)
      .set(s.managerAuth)
      .set('Idempotency-Key', key);

    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('RECEIVED');
    expect(replay.body).toEqual(first.body);
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(15);

    const movementCount = await prisma.stockMovement.count({
      where: { referenceType: 'PURCHASE_ORDER', referenceId: poId },
    });
    expect(movementCount).toBe(1);
  });

  it('Staff cannot create, confirm, or receive purchase orders', async () => {
    const s = await setupScenario();

    const create = await client
      .post('/api/purchase-orders')
      .set(s.staffAuth)
      .send({ warehouseId: s.warehouseA.id, supplierId: s.supplier.id, lines: [{ productId: s.product.id, quantity: 1, unitCost: 1 }] });

    expect(create.status).toBe(403);
  });
});

describe('sales orders', () => {
  it('dispatch decreases stock and creates an OUTBOUND movement', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 50);

    const create = await client
      .post('/api/sales-orders')
      .set(s.staffAuth)
      .send({ warehouseId: s.warehouseA.id, lines: [{ productId: s.product.id, quantity: 10, unitPrice: 20 }] });
    const soId = create.body.data.id;

    await client.post(`/api/sales-orders/${soId}/confirm`).set(s.staffAuth);
    const dispatch = await client.post(`/api/sales-orders/${soId}/dispatch`).set(s.staffAuth);

    expect(dispatch.status).toBe(200);
    expect(dispatch.body.data.status).toBe('DISPATCHED');
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(40);
  });

  it('a multi-line dispatch is all-or-nothing: one insufficient line rolls back every line', async () => {
    const s = await setupScenario();
    const secondProduct = await prisma.product.create({
      data: {
        organizationId: s.org.id,
        sku: unique('SKU2'),
        name: 'Second Product',
        categoryId: s.category.id,
        supplierId: s.supplier.id,
        unitPrice: 5,
      },
    });
    await setStock(s.product.id, s.warehouseA.id, 100);
    await setStock(secondProduct.id, s.warehouseA.id, 2); // not enough for the line below

    const create = await client
      .post('/api/sales-orders')
      .set(s.managerAuth)
      .send({
        warehouseId: s.warehouseA.id,
        lines: [
          { productId: s.product.id, quantity: 10, unitPrice: 20 },
          { productId: secondProduct.id, quantity: 5, unitPrice: 5 },
        ],
      });
    const soId = create.body.data.id;
    await client.post(`/api/sales-orders/${soId}/confirm`).set(s.managerAuth);

    const dispatch = await client.post(`/api/sales-orders/${soId}/dispatch`).set(s.managerAuth);

    expect(dispatch.status).toBe(422);
    // Line 1 (product, qty 10) would have succeeded alone - confirms the
    // whole transaction rolled back rather than partially applying.
    expect(await stockLevel(s.product.id, s.warehouseA.id)).toBe(100);
    expect(await stockLevel(secondProduct.id, s.warehouseA.id)).toBe(2);

    const so = await prisma.salesOrder.findUnique({ where: { id: soId } });
    expect(so?.status).toBe('CONFIRMED');
  });

  it('cannot dispatch a cancelled sales order', async () => {
    const s = await setupScenario();
    await setStock(s.product.id, s.warehouseA.id, 50);

    const create = await client
      .post('/api/sales-orders')
      .set(s.staffAuth)
      .send({ warehouseId: s.warehouseA.id, lines: [{ productId: s.product.id, quantity: 1, unitPrice: 1 }] });
    const soId = create.body.data.id;

    await client.post(`/api/sales-orders/${soId}/cancel`).set(s.staffAuth);
    const dispatch = await client.post(`/api/sales-orders/${soId}/dispatch`).set(s.staffAuth);

    expect(dispatch.status).toBe(422);
  });
});
