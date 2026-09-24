// Hand-maintained OpenAPI 3.0 document, kept in sync with the Zod schemas
// in each module manually rather than generated from them - given the
// project's timeframe, a static spec reviewed against the real routes was
// more reliable than wiring a zod-to-openapi pipeline across ~35 endpoints.
// Noted as a "nice to automate later" in the README's pending-items list.

const bearerAuth = { bearerAuth: [] as string[] };

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
];

function paginatedResponse(itemRef: string) {
  return {
    description: 'Paginated list',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { $ref: itemRef } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
      },
    },
  };
}

function okResponse(ref: string, description = 'OK') {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { success: { type: 'boolean', example: true }, data: { $ref: ref } },
        },
      },
    },
  };
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Praella Warehouse/Inventory Management System API',
    version: '1.0.0',
    description:
      'REST API for the Praella Senior Backend Developer practical test - multi-tenant warehouse & inventory management with RBAC, stock movement ledger, transfers, and purchase/sales orders.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'object', nullable: true },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organizationId: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'STAFF'] },
            },
          },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      Warehouse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          organizationId: { type: 'string' },
          name: { type: 'string' },
          address: { type: 'string', nullable: true },
          createdById: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Category: {
        type: 'object',
        properties: { id: { type: 'string' }, organizationId: { type: 'string' }, name: { type: 'string' } },
      },
      Supplier: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          organizationId: { type: 'string' },
          name: { type: 'string' },
          contactEmail: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          organizationId: { type: 'string' },
          sku: { type: 'string' },
          name: { type: 'string' },
          categoryId: { type: 'string' },
          supplierId: { type: 'string' },
          unitPrice: { type: 'string', description: 'Decimal, serialized as a string' },
        },
      },
      StockLevel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          productId: { type: 'string' },
          warehouseId: { type: 'string' },
          quantity: { type: 'integer' },
        },
      },
      StockMovement: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          productId: { type: 'string' },
          type: { type: 'string', enum: ['INBOUND', 'OUTBOUND', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT'] },
          quantity: { type: 'integer' },
          fromWarehouseId: { type: 'string', nullable: true },
          toWarehouseId: { type: 'string', nullable: true },
          actorUserId: { type: 'string' },
          referenceType: { type: 'string', nullable: true, enum: ['PURCHASE_ORDER', 'SALES_ORDER', 'TRANSFER', 'MANUAL'] },
          referenceId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ReplenishmentRule: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          productId: { type: 'string' },
          warehouseId: { type: 'string' },
          minThreshold: { type: 'integer' },
        },
      },
      LowStockAlert: {
        type: 'object',
        properties: {
          product: { $ref: '#/components/schemas/Product' },
          warehouse: { $ref: '#/components/schemas/Warehouse' },
          minThreshold: { type: 'integer' },
          currentQuantity: { type: 'integer' },
        },
      },
      PurchaseOrder: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          organizationId: { type: 'string' },
          warehouseId: { type: 'string' },
          supplierId: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED'] },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'integer' },
                unitCost: { type: 'string' },
              },
            },
          },
        },
      },
      SalesOrder: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          organizationId: { type: 'string' },
          warehouseId: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'DISPATCHED', 'CANCELLED'] },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'integer' },
                unitPrice: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  security: [bearerAuth],
  paths: {
    '/health': {
      get: { tags: ['Health'], security: [], summary: 'Liveness check', responses: { '200': { description: 'OK' } } },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        security: [],
        summary: 'Readiness check (DB reachable)',
        responses: { '200': { description: 'Ready' }, '503': { description: 'Not ready' } },
      },
    },
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Create a new organization and its first Admin user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['organizationName', 'email', 'password'],
                properties: {
                  organizationName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { '201': okResponse('#/components/schemas/AuthTokens'), '409': errorResponse('Email already registered') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Log in with email + password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': okResponse('#/components/schemas/AuthTokens'), '401': errorResponse('Invalid credentials') },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Rotate a refresh token for a new access/refresh pair',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
            },
          },
        },
        responses: { '200': okResponse('#/components/schemas/AuthTokens'), '401': errorResponse('Invalid/expired/reused token') },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Revoke a refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
            },
          },
        },
        responses: { '204': { description: 'No content' } },
      },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current authenticated user', responses: { '200': okResponse('#/components/schemas/AuthTokens'), '401': errorResponse('Not authenticated') } },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users in the caller org (Admin only)',
        responses: { '200': { description: 'OK' }, '403': errorResponse('Not an Admin') },
      },
    },
    '/warehouses': {
      get: {
        tags: ['Warehouses'],
        summary: 'List warehouses (Admin: all in org; others: only their memberships)',
        parameters: paginationParams,
        responses: { '200': paginatedResponse('#/components/schemas/Warehouse') },
      },
      post: {
        tags: ['Warehouses'],
        summary: 'Create a warehouse (Admin only)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, address: { type: 'string' } } } } } },
        responses: { '201': okResponse('#/components/schemas/Warehouse'), '403': errorResponse('Not an Admin') },
      },
    },
    '/warehouses/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Warehouses'], summary: 'Get a warehouse', responses: { '200': okResponse('#/components/schemas/Warehouse'), '403': errorResponse('Not a member'), '404': errorResponse('Not found') } },
      patch: {
        tags: ['Warehouses'],
        summary: 'Update a warehouse (Admin, Manager)',
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, address: { type: 'string' } } } } } },
        responses: { '200': okResponse('#/components/schemas/Warehouse') },
      },
      delete: {
        tags: ['Warehouses'],
        summary: 'Delete a warehouse (Admin only). Fails with 409 if it has stock/order history.',
        responses: { '204': { description: 'Deleted' }, '409': errorResponse('Referenced by stock/order history') },
      },
    },
    '/warehouses/{id}/members': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Warehouses'],
        summary: 'Add/update a warehouse member (Admin, Manager)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' }, role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'STAFF'] } } } } } },
        responses: { '201': { description: 'Member added' } },
      },
    },
    '/warehouses/{id}/members/{userId}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      delete: { tags: ['Warehouses'], summary: 'Remove a warehouse member (Admin, Manager)', responses: { '204': { description: 'Removed' } } },
    },
    '/categories': {
      get: { tags: ['Catalog'], summary: 'List categories', parameters: paginationParams, responses: { '200': paginatedResponse('#/components/schemas/Category') } },
      post: { tags: ['Catalog'], summary: 'Create a category (Admin, Manager)', responses: { '201': okResponse('#/components/schemas/Category') } },
    },
    '/suppliers': {
      get: { tags: ['Catalog'], summary: 'List suppliers', parameters: paginationParams, responses: { '200': paginatedResponse('#/components/schemas/Supplier') } },
      post: { tags: ['Catalog'], summary: 'Create a supplier (Admin, Manager)', responses: { '201': okResponse('#/components/schemas/Supplier') } },
    },
    '/products': {
      get: {
        tags: ['Catalog'],
        summary: 'List products (filter: categoryId, warehouseId, search)',
        parameters: [
          ...paginationParams,
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'warehouseId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': paginatedResponse('#/components/schemas/Product') },
      },
      post: {
        tags: ['Catalog'],
        summary: 'Create a product (Admin, Manager)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sku', 'name', 'categoryId', 'supplierId', 'unitPrice'],
                properties: {
                  sku: { type: 'string' },
                  name: { type: 'string' },
                  categoryId: { type: 'string' },
                  supplierId: { type: 'string' },
                  unitPrice: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '201': okResponse('#/components/schemas/Product'), '409': errorResponse('Duplicate SKU in this org') },
      },
    },
    '/products/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Catalog'], summary: 'Get a product', responses: { '200': okResponse('#/components/schemas/Product') } },
      patch: { tags: ['Catalog'], summary: 'Update a product (Admin, Manager)', responses: { '200': okResponse('#/components/schemas/Product') } },
      delete: { tags: ['Catalog'], summary: 'Delete a product (Admin, Manager). Fails with 409 if it has stock/order history.', responses: { '204': { description: 'Deleted' } } },
    },
    '/stock/levels': {
      get: {
        tags: ['Inventory'],
        summary: 'List current stock levels (filter: warehouseId, productId)',
        parameters: [...paginationParams, { name: 'warehouseId', in: 'query', schema: { type: 'string' } }, { name: 'productId', in: 'query', schema: { type: 'string' } }],
        responses: { '200': paginatedResponse('#/components/schemas/StockLevel') },
      },
    },
    '/stock/movements': {
      get: {
        tags: ['Inventory'],
        summary: 'List stock movement history (filter: warehouseId, productId, type, from, to)',
        parameters: [
          ...paginationParams,
          { name: 'warehouseId', in: 'query', schema: { type: 'string' } },
          { name: 'productId', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': paginatedResponse('#/components/schemas/StockMovement') },
      },
      post: {
        tags: ['Inventory'],
        summary: 'Record a manual INBOUND/OUTBOUND/ADJUSTMENT movement. Staff may record INBOUND/OUTBOUND only.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'warehouseId', 'type', 'quantity'],
                properties: {
                  productId: { type: 'string' },
                  warehouseId: { type: 'string' },
                  type: { type: 'string', enum: ['INBOUND', 'OUTBOUND', 'ADJUSTMENT'] },
                  quantity: { type: 'integer', minimum: 1 },
                  direction: { type: 'string', enum: ['IN', 'OUT'], description: 'Required for ADJUSTMENT' },
                },
              },
            },
          },
        },
        responses: { '201': okResponse('#/components/schemas/StockMovement'), '422': errorResponse('Insufficient stock') },
      },
    },
    '/stock/bulk-update': {
      post: {
        tags: ['Inventory'],
        summary: 'Enqueue a large batch of stock movements (Admin, Manager). Returns immediately with a jobId.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object' }, maxItems: 5000 } } } } } },
        responses: { '202': { description: 'Accepted', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } } } } } } },
      },
    },
    '/stock/bulk-update/{jobId}': {
      parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Inventory'], summary: 'Check a bulk-update job status', responses: { '200': { description: 'Job status' }, '404': errorResponse('Job not found') } },
    },
    '/transfers': {
      get: { tags: ['Inventory'], summary: 'List warehouse transfers', parameters: paginationParams, responses: { '200': paginatedResponse('#/components/schemas/StockMovement') } },
      post: {
        tags: ['Inventory'],
        summary: 'Transfer stock between two warehouses (Admin, Manager). Both legs commit atomically.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'fromWarehouseId', 'toWarehouseId', 'quantity'],
                properties: {
                  productId: { type: 'string' },
                  fromWarehouseId: { type: 'string' },
                  toWarehouseId: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Transfer applied' }, '422': errorResponse('Insufficient stock') },
      },
    },
    '/replenishment-rules': {
      put: {
        tags: ['Inventory'],
        summary: 'Upsert a minimum-stock threshold (Admin, Manager)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'warehouseId', 'minThreshold'],
                properties: { productId: { type: 'string' }, warehouseId: { type: 'string' }, minThreshold: { type: 'integer', minimum: 0 } },
              },
            },
          },
        },
        responses: { '200': okResponse('#/components/schemas/ReplenishmentRule') },
      },
    },
    '/replenishment-rules/alerts': {
      get: { tags: ['Inventory'], summary: 'List products currently below their threshold', parameters: paginationParams, responses: { '200': paginatedResponse('#/components/schemas/LowStockAlert') } },
    },
    '/purchase-orders': {
      get: {
        tags: ['Purchase Orders'],
        summary: 'List purchase orders (filter: warehouseId, status). Staff can view but not create.',
        parameters: [...paginationParams, { name: 'warehouseId', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }],
        responses: { '200': paginatedResponse('#/components/schemas/PurchaseOrder') },
      },
      post: {
        tags: ['Purchase Orders'],
        summary: 'Create a purchase order (Admin, Manager)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['warehouseId', 'supplierId', 'lines'],
                properties: {
                  warehouseId: { type: 'string' },
                  supplierId: { type: 'string' },
                  lines: { type: 'array', items: { type: 'object', properties: { productId: { type: 'string' }, quantity: { type: 'integer' }, unitCost: { type: 'number' } } } },
                },
              },
            },
          },
        },
        responses: { '201': okResponse('#/components/schemas/PurchaseOrder') },
      },
    },
    '/purchase-orders/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Purchase Orders'], summary: 'Get a purchase order', responses: { '200': okResponse('#/components/schemas/PurchaseOrder') } },
    },
    '/purchase-orders/{id}/confirm': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: { tags: ['Purchase Orders'], summary: 'DRAFT -> CONFIRMED', responses: { '200': okResponse('#/components/schemas/PurchaseOrder') } },
    },
    '/purchase-orders/{id}/receive': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Purchase Orders'],
        summary: 'CONFIRMED -> RECEIVED. Applies an INBOUND movement per line atomically. Supports an Idempotency-Key header.',
        parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }],
        responses: { '200': okResponse('#/components/schemas/PurchaseOrder'), '422': errorResponse('Wrong status') },
      },
    },
    '/purchase-orders/{id}/cancel': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: { tags: ['Purchase Orders'], summary: 'DRAFT/CONFIRMED -> CANCELLED', responses: { '200': okResponse('#/components/schemas/PurchaseOrder') } },
    },
    '/sales-orders': {
      get: {
        tags: ['Sales Orders'],
        summary: 'List sales orders (filter: warehouseId, status)',
        parameters: [...paginationParams, { name: 'warehouseId', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }],
        responses: { '200': paginatedResponse('#/components/schemas/SalesOrder') },
      },
      post: {
        tags: ['Sales Orders'],
        summary: 'Create a sales order (Admin, Manager, Staff)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['warehouseId', 'lines'],
                properties: {
                  warehouseId: { type: 'string' },
                  lines: { type: 'array', items: { type: 'object', properties: { productId: { type: 'string' }, quantity: { type: 'integer' }, unitPrice: { type: 'number' } } } },
                },
              },
            },
          },
        },
        responses: { '201': okResponse('#/components/schemas/SalesOrder') },
      },
    },
    '/sales-orders/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Sales Orders'], summary: 'Get a sales order', responses: { '200': okResponse('#/components/schemas/SalesOrder') } },
    },
    '/sales-orders/{id}/confirm': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: { tags: ['Sales Orders'], summary: 'DRAFT -> CONFIRMED', responses: { '200': okResponse('#/components/schemas/SalesOrder') } },
    },
    '/sales-orders/{id}/dispatch': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Sales Orders'],
        summary: 'CONFIRMED -> DISPATCHED. Applies an OUTBOUND movement per line atomically; all-or-nothing on insufficient stock. Supports an Idempotency-Key header.',
        parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }],
        responses: { '200': okResponse('#/components/schemas/SalesOrder'), '422': errorResponse('Insufficient stock / wrong status') },
      },
    },
    '/sales-orders/{id}/cancel': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: { tags: ['Sales Orders'], summary: 'DRAFT/CONFIRMED -> CANCELLED', responses: { '200': okResponse('#/components/schemas/SalesOrder') } },
    },
  },
};
