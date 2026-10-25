import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessRepositoryPort } from '@unna/domain';

/**
 * Allows the request only when the authenticated user owns the business in `:businessId`.
 * Must run after JwtAuthGuard so `req.user` is populated.
 */
@Injectable()
export class BusinessOwnerGuard implements CanActivate {
  constructor(
    @Inject('BusinessRepositoryPort')
    private readonly businessRepository: BusinessRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const businessId: string | undefined = req.params?.businessId;
    if (!businessId) return true;

    const business = await this.businessRepository.findById(businessId);
    if (!business) throw new NotFoundException('Negocio no encontrado');
    if (business.ownerId !== req.user?.sub) {
      throw new ForbiddenException('No tenés permisos sobre este negocio');
    }
    return true;
  }
}
