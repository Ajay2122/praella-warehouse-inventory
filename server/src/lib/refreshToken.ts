import crypto from 'crypto';

// Refresh tokens are opaque random strings, not JWTs: the client holds the
// raw value, the DB stores only its SHA-256 hash. That makes revocation a
// plain row update (RefreshToken.revokedAt) instead of needing a denylist -
// a JWT refresh token would still be "valid" by signature after logout
// unless you maintained one anyway.
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(40).toString('hex');
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
