import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  bulkUpdateSchema,
  jobIdParamSchema,
  listMovementsQuerySchema,
  listStockLevelsQuerySchema,
  listTransfersQuerySchema,
  recordMovementSchema,
  transferSchema,
  upsertReplenishmentRuleSchema,
} from './stock.schemas';
import { paginationQuerySchema } from '../../lib/pagination';
import * as ctrl from './stock.controller';

export const stockRouter = Router();
stockRouter.use(requireAuth);

stockRouter.get('/levels', validate({ query: listStockLevelsQuerySchema }), asyncHandler(ctrl.listLevelsHandler));
stockRouter.get('/movements', validate({ query: listMovementsQuerySchema }), asyncHandler(ctrl.listMovementsHandler));
stockRouter.post(
  '/movements',
  validate({ body: recordMovementSchema }),
  asyncHandler(ctrl.recordMovementHandler),
);
stockRouter.post(
  '/bulk-update',
  requireRole('ADMIN', 'MANAGER'),
  validate({ body: bulkUpdateSchema }),
  asyncHandler(ctrl.bulkUpdateHandler),
);
stockRouter.get(
  '/bulk-update/:jobId',
  validate({ params: jobIdParamSchema }),
  asyncHandler(ctrl.bulkUpdateStatusHandler),
);

export const transferRouter = Router();
transferRouter.use(requireAuth);
transferRouter.post('/', validate({ body: transferSchema }), asyncHandler(ctrl.transferHandler));
transferRouter.get('/', validate({ query: listTransfersQuerySchema }), asyncHandler(ctrl.listTransfersHandler));

export const replenishmentRouter = Router();
replenishmentRouter.use(requireAuth);
replenishmentRouter.put(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  validate({ body: upsertReplenishmentRuleSchema }),
  asyncHandler(ctrl.upsertReplenishmentRuleHandler),
);
replenishmentRouter.get(
  '/alerts',
  validate({ query: paginationQuerySchema }),
  asyncHandler(ctrl.lowStockAlertsHandler),
);
