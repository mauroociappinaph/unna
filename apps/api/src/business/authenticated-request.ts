import type { Request } from 'express';
import type { JwtPayload } from '@unna/domain';

/** Request after JwtAuthGuard: JwtStrategy.validate puts the token payload on `user`. */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
