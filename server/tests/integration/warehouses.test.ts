import { client } from '../helpers/testClient';
import { setupScenario } from '../helpers/fixtures';

describe('warehouses: RBAC, org isolation, membership scoping', () => {
  it('only Admin can create a warehouse', async () => {
    const s = await setupScenario();

    const asManager = await client.post('/api/warehouses').set(s.managerAuth).send({ name: 'Manager Attempt' });
    const asStaff = await client.post('/api/warehouses').set(s.staffAuth).send({ name: 'Staff Attempt' });
    const asAdmin = await client.post('/api/warehouses').set(s.adminAuth).send({ name: 'Admin Warehouse' });

    expect(asManager.status).toBe(403);
    expect(asStaff.status).toBe(403);
    expect(asAdmin.status).toBe(201);
  });

  it('only Admin can delete a warehouse; Manager can update it', async () => {
    const s = await setupScenario();

    const deleteAsManager = await client.delete(`/api/warehouses/${s.warehouseA.id}`).set(s.managerAuth);
    expect(deleteAsManager.status).toBe(403);

    const updateAsManager = await client
      .patch(`/api/warehouses/${s.warehouseA.id}`)
      .set(s.managerAuth)
      .send({ address: 'Updated Address' });
    expect(updateAsManager.status).toBe(200);
    expect(updateAsManager.body.data.address).toBe('Updated Address');
  });

  it('Staff only sees warehouses they are a member of; Admin sees all', async () => {
    const s = await setupScenario();

    const staffList = await client.get('/api/warehouses').set(s.staffAuth);
    const adminList = await client.get('/api/warehouses').set(s.adminAuth);

    const staffIds = staffList.body.data.map((w: { id: string }) => w.id);
    const adminIds = adminList.body.data.map((w: { id: string }) => w.id);

    expect(staffIds).toContain(s.warehouseA.id);
    expect(staffIds).not.toContain(s.warehouseB.id);
    expect(adminIds).toEqual(expect.arrayContaining([s.warehouseA.id, s.warehouseB.id]));
  });

  it('Staff cannot access a warehouse they are not a member of', async () => {
    const s = await setupScenario();

    const res = await client.get(`/api/warehouses/${s.warehouseB.id}`).set(s.staffAuth);

    expect(res.status).toBe(403);
  });

  it('a user from a different organization cannot see or reach another org warehouse (404, not leaked)', async () => {
    const orgA = await setupScenario();
    const orgB = await setupScenario();

    const res = await client.get(`/api/warehouses/${orgA.warehouseA.id}`).set(orgB.adminAuth);

    expect(res.status).toBe(404);
  });
});
