import type { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signAccessToken } from '../../lib/jwt';
import { generateRefreshToken, hashRefreshToken } from '../../lib/refreshToken';
import { AppError } from '../../lib/errors';
import { env } from '../../config/env';
import type { LoginInput, SignupInput } from './auth.schemas';

interface UserRecord {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
}

async function issueTokenPair(user: UserRecord) {
  const accessToken = signAccessToken({ sub: user.id, organizationId: user.organizationId, role: user.role });

  const { raw, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });

  return { accessToken, refreshToken: raw };
}

function toPublicUser(user: UserRecord) {
  return { id: user.id, organizationId: user.organizationId, email: user.email, role: user.role };
}

// Signup creates a brand-new Organization with the signing-up user as its
// first ADMIN. There's no "join an existing org by name" path - collaborators
// are added afterward via POST /api/warehouses/:id/members (Phase 5).
export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('CONFLICT', 'Email already registered');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: input.organizationName } });
    return tx.user.create({
      data: { organizationId: org.id, email: input.email, passwordHash, role: 'ADMIN' },
    });
  });

  const tokens = await issueTokenPair(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same error for "no such user" and "wrong password" - don't leak which
  // one it was.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError('UNAUTHENTICATED', 'Invalid email or password');
  }

  const tokens = await issueTokenPair(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(rawToken: string) {
  const hash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new AppError('UNAUTHENTICATED', 'Invalid or expired refresh token');
  }

  // Rotation: this token is single-use. Revoke it, issue a fresh pair. If
  // a revoked token is ever presented again, that's a replay signal - we
  // reject it the same as any other invalid token rather than doing
  // anything more elaborate, which is enough for this scope.
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });

  return issueTokenPair(existing.user);
}

export async function logout(rawToken: string) {
  const hash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
