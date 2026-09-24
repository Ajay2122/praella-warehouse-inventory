import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idempotent } from '../../middleware/idempotency';
import { asyncHandler } from '../../lib/asyncHandler';
import { createSalesOrderSchema, listSalesOrdersQuerySchema, salesOrderIdParamSchema } from './salesOrder.schemas';
import * as ctrl from './salesOrder.controller';

export const salesOrderRouter = Router();
salesOrderRouter.use(requireAuth);

salesOrderRouter.post('/', validate({ body: createSalesOrderSchema }), asyncHandler(ctrl.createHandler));
salesOrderRouter.get('/', validate({ query: listSalesOrdersQuerySchema }), asyncHandler(ctrl.listHandler));
salesOrderRouter.get('/:id', validate({ params: salesOrderIdParamSchema }), asyncHandler(ctrl.getHandler));
salesOrderRouter.post(
  '/:id/confirm',
  validate({ params: salesOrderIdParamSchema }),
  asyncHandler(ctrl.confirmHandler),
);
salesOrderRouter.post(
  '/:id/dispatch',
  validate({ params: salesOrderIdParamSchema }),
  idempotent(),
  asyncHandler(ctrl.dispatchHandler),
);
salesOrderRouter.post(
  '/:id/cancel',
  validate({ params: salesOrderIdParamSchema }),
  asyncHandler(ctrl.cancelHandler),
);
