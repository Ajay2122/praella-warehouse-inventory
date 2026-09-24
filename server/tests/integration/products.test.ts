import { client } from '../helpers/testClient';
import { setupScenario, unique } from '../helpers/fixtures';

describe('products: CRUD, RBAC, duplicate SKU', () => {
  it('Admin/Manager can create a product; Staff cannot', async () => {
    const s = await setupScenario();
    const body = {
      sku: unique('SKU'),
      name: 'New Product',
      categoryId: s.category.id,
      supplierId: s.supplier.id,
      unitPrice: 25,
    };

    const asStaff = await client.post('/api/products').set(s.staffAuth).send({ ...body, sku: unique('SKU') });
    const asManager = await client.post('/api/products').set(s.managerAuth).send(body);

    expect(asStaff.status).toBe(403);
    expect(asManager.status).toBe(201);
  });

  it('rejects a duplicate SKU within the same organization', async () => {
    const s = await setupScenario();
    const sku = unique('DUPSKU');
    const body = { sku, name: 'Dup A', categoryId: s.category.id, supplierId: s.supplier.id, unitPrice: 5 };

    const first = await client.post('/api/products').set(s.adminAuth).send(body);
    const second = await client
      .post('/api/products')
      .set(s.adminAuth)
      .send({ ...body, name: 'Dup B' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it('allows the same SKU string across two different organizations', async () => {
    const orgA = await setupScenario();
    const orgB = await setupScenario();
    const sku = unique('SHARED-SKU');

    const a = await client
      .post('/api/products')
      .set(orgA.adminAuth)
      .send({ sku, name: 'A', categoryId: orgA.category.id, supplierId: orgA.supplier.id, unitPrice: 1 });
    const b = await client
      .post('/api/products')
      .set(orgB.adminAuth)
      .send({ sku, name: 'B', categoryId: orgB.category.id, supplierId: orgB.supplier.id, unitPrice: 1 });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  it('search filters by name/SKU, scoped to the caller org', async () => {
    const s = await setupScenario();

    const res = await client.get(`/api/products?search=${encodeURIComponent(s.product.name)}`).set(s.adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { id: string }) => p.id === s.product.id)).toBe(true);
  });
});
