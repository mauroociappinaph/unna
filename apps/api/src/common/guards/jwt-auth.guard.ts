import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '@unna/domain';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = JwtPayload>(err: unknown, user: TUser | false | null): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Token inválido o expirado');
    }
    return user;
  }
}