import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { requireWarehouseAccess, requireWarehouseRole } from '../../middleware/warehouseAccess';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  addMemberSchema,
  createWarehouseSchema,
  listWarehousesQuerySchema,
  updateWarehouseSchema,
  warehouseIdParamSchema,
  warehouseMemberParamSchema,
} from './warehouse.schemas';
import * as ctrl from './warehouse.controller';

export const warehouseRouter = Router();

warehouseRouter.use(requireAuth);

warehouseRouter.get('/', validate({ query: listWarehousesQuerySchema }), asyncHandler(ctrl.listHandler));

warehouseRouter.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: createWarehouseSchema }),
  asyncHandler(ctrl.createHandler),
);

warehouseRouter.get(
  '/:id',
  validate({ params: warehouseIdParamSchema }),
  requireWarehouseAccess(),
  asyncHandler(ctrl.getHandler),
);

warehouseRouter.patch(
  '/:id',
  validate({ params: warehouseIdParamSchema, body: updateWarehouseSchema }),
  requireWarehouseAccess(),
  requireWarehouseRole('ADMIN', 'MANAGER'),
  asyncHandler(ctrl.updateHandler),
);

warehouseRouter.delete(
  '/:id',
  validate({ params: warehouseIdParamSchema }),
  requireRole('ADMIN'),
  asyncHandler(ctrl.deleteHandler),
);

warehouseRouter.post(
  '/:id/members',
  validate({ params: warehouseIdParamSchema, body: addMemberSchema }),
  requireWarehouseAccess(),
  requireWarehouseRole('ADMIN', 'MANAGER'),
  asyncHandler(ctrl.addMemberHandler),
);

warehouseRouter.delete(
  '/:id/members/:userId',
  validate({ params: warehouseMemberParamSchema }),
  requireWarehouseAccess(),
  requireWarehouseRole('ADMIN', 'MANAGER'),
  asyncHandler(ctrl.removeMemberHandler),
);
