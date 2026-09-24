import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idempotent } from '../../middleware/idempotency';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  createPurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
  purchaseOrderIdParamSchema,
} from './purchaseOrder.schemas';
import * as ctrl from './purchaseOrder.controller';

export const purchaseOrderRouter = Router();
purchaseOrderRouter.use(requireAuth);

purchaseOrderRouter.post('/', validate({ body: createPurchaseOrderSchema }), asyncHandler(ctrl.createHandler));
purchaseOrderRouter.get('/', validate({ query: listPurchaseOrdersQuerySchema }), asyncHandler(ctrl.listHandler));
purchaseOrderRouter.get('/:id', validate({ params: purchaseOrderIdParamSchema }), asyncHandler(ctrl.getHandler));
purchaseOrderRouter.post(
  '/:id/confirm',
  validate({ params: purchaseOrderIdParamSchema }),
  asyncHandler(ctrl.confirmHandler),
);
purchaseOrderRouter.post(
  '/:id/receive',
  validate({ params: purchaseOrderIdParamSchema }),
  idempotent(),
  asyncHandler(ctrl.receiveHandler),
);
purchaseOrderRouter.post(
  '/:id/cancel',
  validate({ params: purchaseOrderIdParamSchema }),
  asyncHandler(ctrl.cancelHandler),
);
