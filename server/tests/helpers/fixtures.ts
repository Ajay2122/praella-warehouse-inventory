import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/password';
import { client } from './testClient';

const PASSWORD = 'Passw0rd!';
let counter = 0;

function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function loginAs(email: string, password = PASSWORD) {
  const res = await client.post('/api/auth/login').send({ email, password });
  return res.body.data as { accessToken: string; refreshToken: string };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// One organization with Admin/Manager/Staff users, two warehouses (Staff is
// only a member of warehouseA, used to test membership scoping), and one
// product - the shared scenario nearly every integration test builds on.
export async function setupScenario() {
  const org = await prisma.organization.create({ data: { name: unique('Org') } });
  const passwordHash = await hashPassword(PASSWORD);

  const admin = await prisma.user.create({
    data: { organizationId: org.id, email: `${unique('admin')}@test.local`, passwordHash, role: 'ADMIN' },
  });
  const manager = await prisma.user.create({
    data: { organizationId: org.id, email: `${unique('manager')}@test.local`, passwordHash, role: 'MANAGER' },
  });
  const staff = await prisma.user.create({
    data: { organizationId: org.id, email: `${unique('staff')}@test.local`, passwordHash, role: 'STAFF' },
  });

  const warehouseA = await prisma.warehouse.create({
    data: { organizationId: org.id, name: unique('WH-A'), createdById: admin.id },
  });
  const warehouseB = await prisma.warehouse.create({
    data: { organizationId: org.id, name: unique('WH-B'), createdById: admin.id },
  });

  await prisma.warehouseMember.createMany({
    data: [
      { warehouseId: warehouseA.id, userId: admin.id, role: 'ADMIN' },
      { warehouseId: warehouseA.id, userId: manager.id },
      { warehouseId: warehouseA.id, userId: staff.id },
      { warehouseId: warehouseB.id, userId: admin.id, role: 'ADMIN' },
      { warehouseId: warehouseB.id, userId: manager.id },
      // staff is deliberately NOT a member of warehouseB
    ],
  });

  const category = await prisma.category.create({ data: { organizationId: org.id, name: unique('Category') } });
  const supplier = await prisma.supplier.create({ data: { organizationId: org.id, name: unique('Supplier') } });
  const product = await prisma.product.create({
    data: {
      organizationId: org.id,
      sku: unique('SKU'),
      name: unique('Widget'),
      categoryId: category.id,
      supplierId: supplier.id,
      unitPrice: 10,
    },
  });

  const [adminTokens, managerTokens, staffTokens] = await Promise.all([
    loginAs(admin.email),
    loginAs(manager.email),
    loginAs(staff.email),
  ]);

  return {
    org,
    admin,
    manager,
    staff,
    warehouseA,
    warehouseB,
    category,
    supplier,
    product,
    password: PASSWORD,
    adminToken: adminTokens.accessToken,
    managerToken: managerTokens.accessToken,
    staffToken: staffTokens.accessToken,
    adminAuth: authHeader(adminTokens.accessToken),
    managerAuth: authHeader(managerTokens.accessToken),
    staffAuth: authHeader(staffTokens.accessToken),
  };
}

export async function stockLevel(productId: string, warehouseId: string): Promise<number> {
  const level = await prisma.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return level?.quantity ?? 0;
}

export async function setStock(productId: string, warehouseId: string, quantity: number): Promise<void> {
  await prisma.stockLevel.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: { productId, warehouseId, quantity },
    update: { quantity },
  });
}

export { unique };
