import { PrismaClient, Role, MovementType, ReferenceType } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

// Fixed demo password for every seeded user - fine for a local/test seed,
// never do this for anything real.
const DEMO_PASSWORD = 'Passw0rd!';

async function main() {
  console.log('Seeding...');

  const org = await prisma.organization.create({
    data: { name: 'Acme Retail' },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admin = await prisma.user.create({
    data: { organizationId: org.id, email: 'admin@acme.test', passwordHash, role: Role.ADMIN },
  });
  const manager = await prisma.user.create({
    data: { organizationId: org.id, email: 'manager@acme.test', passwordHash, role: Role.MANAGER },
  });
  const staff = await prisma.user.create({
    data: { organizationId: org.id, email: 'staff@acme.test', passwordHash, role: Role.STAFF },
  });

  // Mirrors the iPhone/Surat/Mumbai/Ahmedabad example from the practical
  // test brief, so the sample data reads the same way the spec does.
  const [surat, mumbai, ahmedabad] = await Promise.all([
    prisma.warehouse.create({
      data: { organizationId: org.id, name: 'Surat DC', address: 'Surat, GJ', createdById: admin.id },
    }),
    prisma.warehouse.create({
      data: { organizationId: org.id, name: 'Mumbai DC', address: 'Mumbai, MH', createdById: admin.id },
    }),
    prisma.warehouse.create({
      data: { organizationId: org.id, name: 'Ahmedabad DC', address: 'Ahmedabad, GJ', createdById: admin.id },
    }),
  ]);

  // Admin + Manager collaborate on all three warehouses; Staff is scoped to
  // Surat only, to demonstrate warehouse-level access restriction.
  await prisma.warehouseMember.createMany({
    data: [
      { warehouseId: surat.id, userId: admin.id },
      { warehouseId: mumbai.id, userId: admin.id },
      { warehouseId: ahmedabad.id, userId: admin.id },
      { warehouseId: surat.id, userId: manager.id },
      { warehouseId: mumbai.id, userId: manager.id },
      { warehouseId: ahmedabad.id, userId: manager.id },
      { warehouseId: surat.id, userId: staff.id },
    ],
  });

  const mobiles = await prisma.category.create({ data: { organizationId: org.id, name: 'Mobiles' } });
  const accessories = await prisma.category.create({
    data: { organizationId: org.id, name: 'Accessories' },
  });

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: org.id,
      name: 'Global Supplier Co.',
      contactEmail: 'sales@globalsupplier.test',
      phone: '+91-99999-00000',
    },
  });

  const iphone = await prisma.product.create({
    data: {
      organizationId: org.id,
      sku: 'IP15-128',
      name: 'iPhone 15 (128GB)',
      categoryId: mobiles.id,
      supplierId: supplier.id,
      unitPrice: 799.0,
    },
  });

  const airpods = await prisma.product.create({
    data: {
      organizationId: org.id,
      sku: 'APP-2GEN',
      name: 'AirPods Pro (2nd gen)',
      categoryId: accessories.id,
      supplierId: supplier.id,
      unitPrice: 249.0,
    },
  });

  // Stock levels matching the brief's example exactly: iPhone 15 -
  // Surat 100 / Mumbai 50 / Ahmedabad 25.
  const stockLevels: Array<{ productId: string; warehouseId: string; quantity: number }> = [
    { productId: iphone.id, warehouseId: surat.id, quantity: 100 },
    { productId: iphone.id, warehouseId: mumbai.id, quantity: 50 },
    { productId: iphone.id, warehouseId: ahmedabad.id, quantity: 25 },
    { productId: airpods.id, warehouseId: surat.id, quantity: 10 },
  ];

  for (const level of stockLevels) {
    await prisma.stockLevel.create({ data: level });
  }

  // Every StockLevel above is backed by an INBOUND movement, honoring the
  // "never change stock without a movement" rule from day one.
  await prisma.stockMovement.createMany({
    data: stockLevels.map((level) => ({
      productId: level.productId,
      type: MovementType.INBOUND,
      quantity: level.quantity,
      toWarehouseId: level.warehouseId,
      actorUserId: admin.id,
      referenceType: ReferenceType.MANUAL,
    })),
  });

  // AirPods at Surat (10) sit below this threshold (20) on purpose, so the
  // low-stock alert endpoint has something to return immediately.
  await prisma.replenishmentRule.create({
    data: { productId: airpods.id, warehouseId: surat.id, minThreshold: 20 },
  });

  console.log('Seed complete.');
  console.log(`Organization: ${org.name} (${org.id})`);
  console.log(`Login (any of these, password "${DEMO_PASSWORD}"):`);
  console.log(`  ${admin.email}  (ADMIN)`);
  console.log(`  ${manager.email}  (MANAGER)`);
  console.log(`  ${staff.email}  (STAFF, Surat DC only)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
