export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  businessId?: string;
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
}