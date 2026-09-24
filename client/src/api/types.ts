export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface Single<T> {
  success: true;
  data: T;
}

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface User {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
}

export interface Warehouse {
  id: string;
  organizationId: string;
  name: string;
  address?: string | null;
  createdById: string;
  createdAt: string;
}

export interface WarehouseMember {
  id: string;
  warehouseId: string;
  userId: string;
  role: Role | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail?: string | null;
  phone?: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  supplierId: string;
  unitPrice: string;
  category?: Category;
  supplier?: Supplier;
  stockLevels?: StockLevel[];
}

export interface StockLevel {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  product?: Product;
  warehouse?: Warehouse;
}

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  createdAt: string;
  product?: Product;
  fromWarehouse?: Warehouse;
  toWarehouse?: Warehouse;
}

export interface ReplenishmentRule {
  id: string;
  productId: string;
  warehouseId: string;
  minThreshold: number;
}

export interface LowStockAlert {
  product: Product;
  warehouse: Warehouse;
  minThreshold: number;
  currentQuantity: number;
}

export type PurchaseOrderStatus = 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  quantity: number;
  unitCost: string;
  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  warehouseId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  warehouse?: Warehouse;
  supplier?: Supplier;
  createdAt: string;
}

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'CANCELLED';

export interface SalesOrderLine {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  product?: Product;
}

export interface SalesOrder {
  id: string;
  warehouseId: string;
  status: SalesOrderStatus;
  lines: SalesOrderLine[];
  warehouse?: Warehouse;
  createdAt: string;
}
