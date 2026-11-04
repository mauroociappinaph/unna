import { createHash } from 'node:crypto';
import { JwtPayload, User } from '@unna/domain';

/** `type` claim of each session token, so one kind is never accepted where another is expected. */
export const ACCESS_TOKEN_TYPE = 'access';
export const REFRESH_TOKEN_TYPE = 'refresh';

export const SESSION_EXPIRED = 'Sesión vencida. Iniciá sesión de nuevo.';

/**
 * Short fingerprint of the stored password hash. Session and reset tokens carry it, so changing
 * the password ends every open session and spends every reset link issued before. The bcrypt hash
 * has a random salt, so the fingerprint gives no way to guess the password offline.
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

/** Claims of the access and refresh tokens of a user's session. */
export function sessionClaims(user: User): JwtPayload {
  return {
    sub: user.id,
    email: user.email.value,
    role: user.roles[0],
    businessId: undefined,
    pwd: passwordFingerprint(user.password.hash),
  };
}

/** Whether a verified token still belongs to a usable session of this user. */
export function isSessionOf(user: User | null, claims: Partial<JwtPayload>): user is User {
  return !!user && user.isActive && user.email.value === claims.email && claims.pwd === passwordFingerprint(user.password.hash);
}
