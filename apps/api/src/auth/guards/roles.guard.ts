import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole, hasRole } from '@unna/domain';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      throw new ForbiddenException('No tenés permisos para acceder a este recurso');
    }

    const userRoles = user.roles as UserRole[];
    const hasRequiredRole = requiredRoles.some(role => hasRole(userRoles, role));

    if (!hasRequiredRole) {
      throw new ForbiddenException(`Se requiere rol: ${requiredRoles.join(' o ')}`);
    }

    return true;
  }
}