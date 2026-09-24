import { AppError } from './errors';

// The one rule everything else depends on: never trust an organizationId
// from the request body - only from req.user (see requireAuth). This
// helper is how every service confirms a loaded row actually belongs to
// the caller's org before returning/mutating it. A mismatch reads as 404,
// not 403 - it shouldn't be observable whether the row exists in someone
// else's org.
export function assertOrgScope(resourceOrgId: string, userOrgId: string): void {
  if (resourceOrgId !== userOrgId) {
    throw new AppError('NOT_FOUND', 'Resource not found');
  }
}
