import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { assertOrgScope } from '../../lib/orgScope';
import { paginationArgs, paginationMeta, type PaginationInput } from '../../lib/pagination';
import { cacheGetOrSet, cacheInvalidate, cacheKeys, hashQuery } from '../../lib/cache';
import { writeAuditLog } from '../../lib/audit';
import type { CreateProductInput, UpdateProductInput } from './product.schemas';

interface ListParams extends PaginationInput {
  search?: string;
  categoryId?: string;
  warehouseId?: string;
  organizationId: string;
}

export async function listProducts(params: ListParams) {
  const { organizationId, page, pageSize, search, categoryId, warehouseId } = params;

  const cacheKey = cacheKeys.productList(
    organizationId,
    hashQuery({ page, pageSize, search, categoryId, warehouseId }),
  );

  return cacheGetOrSet(cacheKey, async () => {
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(categoryId ? { categoryId } : {}),
      ...(warehouseId ? { stockLevels: { some: { warehouseId } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        ...paginationArgs({ page, pageSize }),
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          supplier: true,
          stockLevels: warehouseId ? { where: { warehouseId } } : false,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { data, pagination: paginationMeta({ page, pageSize }, total) };
  });
}

async function assertCatalogRefsBelongToOrg(
  organizationId: string,
  categoryId?: string,
  supplierId?: string,
) {
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new AppError('VALIDATION_ERROR', 'Invalid categoryId');
    assertOrgScope(category.organizationId, organizationId);
  }
  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new AppError('VALIDATION_ERROR', 'Invalid supplierId');
    assertOrgScope(supplier.organizationId, organizationId);
  }
}

export async function createProduct(input: CreateProductInput, organizationId: string, actorUserId: string) {
  await assertCatalogRefsBelongToOrg(organizationId, input.categoryId, input.supplierId);
  const product = await prisma.product.create({
    data: {
      organizationId,
      sku: input.sku,
      name: input.name,
      categoryId: input.categoryId,
      supplierId: input.supplierId,
      unitPrice: input.unitPrice,
    },
  });
  await cacheInvalidate(cacheKeys.productListPattern(organizationId));
  writeAuditLog({
    organizationId,
    userId: actorUserId,
    action: 'PRODUCT_CREATED',
    entity: 'Product',
    entityId: product.id,
    newValue: product,
  });
  return product;
}

export async function getProduct(id: string, organizationId: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, supplier: true },
  });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found');
  assertOrgScope(product.organizationId, organizationId);
  return product;
}

export async function updateProduct(
  id: string,
  organizationId: string,
  input: UpdateProductInput,
  actorUserId: string,
) {
  const before = await getProduct(id, organizationId);
  await assertCatalogRefsBelongToOrg(organizationId, input.categoryId, input.supplierId);
  const product = await prisma.product.update({ where: { id }, data: input });
  await cacheInvalidate(cacheKeys.productListPattern(organizationId));
  writeAuditLog({
    organizationId,
    userId: actorUserId,
    action: 'PRODUCT_UPDATED',
    entity: 'Product',
    entityId: id,
    oldValue: before,
    newValue: product,
  });
  return product;
}

export async function deleteProduct(id: string, organizationId: string, actorUserId: string) {
  const before = await getProduct(id, organizationId);
  // Cascades away StockLevel/ReplenishmentRule rows; blocked (FK -> 409) if
  // the product has any StockMovement or order-line history - same pattern
  // as warehouse deletion.
  await prisma.product.delete({ where: { id } });
  await cacheInvalidate(cacheKeys.productListPattern(organizationId));
  writeAuditLog({
    organizationId,
    userId: actorUserId,
    action: 'PRODUCT_DELETED',
    entity: 'Product',
    entityId: id,
    oldValue: before,
  });
}
