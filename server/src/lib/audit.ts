import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type AuditAction =
  | 'WAREHOUSE_CREATED'
  | 'WAREHOUSE_UPDATED'
  | 'WAREHOUSE_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'STOCK_ADJUSTED'
  | 'STOCK_TRANSFERRED'
  | 'PURCHASE_ORDER_RECEIVED'
  | 'SALES_ORDER_DISPATCHED';

interface AuditInput {
  organizationId: string;
  userId: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}

// Fire-and-forget by design: an audit log write failing must never fail
// the business operation it's recording. Called after the operation's own
// transaction has already committed, not from inside it - the audit trail
// is a record of what happened, not a participant in whether it happens.
export function writeAuditLog(input: AuditInput): void {
  prisma.auditLog
    .create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        oldValue: (input.oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
        newValue: (input.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch((err) => console.error('[audit] failed to write audit log', err));
}
