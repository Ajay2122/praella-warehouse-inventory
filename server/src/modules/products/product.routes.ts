import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from './product.schemas';
import * as ctrl from './product.controller';

export const productRouter = Router();
productRouter.use(requireAuth);

productRouter.get('/', validate({ query: listProductsQuerySchema }), asyncHandler(ctrl.listHandler));

productRouter.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  validate({ body: createProductSchema }),
  asyncHandler(ctrl.createHandler),
);

productRouter.get('/:id', validate({ params: productIdParamSchema }), asyncHandler(ctrl.getHandler));

productRouter.patch(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  asyncHandler(ctrl.updateHandler),
);

productRouter.delete(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  validate({ params: productIdParamSchema }),
  asyncHandler(ctrl.deleteHandler),
);
