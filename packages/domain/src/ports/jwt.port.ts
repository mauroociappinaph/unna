export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  businessId?: string;
  /** Fingerprint of the password hash at sign-in; a password change ends the session. */
  pwd?: string;
}

export interface ResetTokenPayload {
  sub: string;
  email: string;
  type: 'password_reset' | 'email_verification';
  /** Fingerprint of the password hash when the link was issued; a reset link works once. */
  pwd?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPort {
  generateAccessToken(payload: JwtPayload): string;
  generateRefreshToken(payload: JwtPayload): string;
  generateTokenPair(payload: JwtPayload): TokenPair;
  verifyAccessToken(token: string): JwtPayload | null;
  verifyRefreshToken(token: string): JwtPayload | null;
  decodeToken(token: string): JwtPayload | null;
  generateResetToken(payload: ResetTokenPayload): string;
  verifyResetToken(token: string): ResetTokenPayload;
}