import { Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { PreorderSettingsUseCase } from './use-cases/preorder-settings.use-case';

/** Pedido anticipado per sucursal (S20): the public menu link and its QR. */
@ApiTags('Pedido anticipado')
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class PreorderController {
  constructor(private readonly settings: PreorderSettingsUseCase) {}

  @Get('pedido-anticipado')
  @ApiOperation({ summary: 'Sucursales con su link de pedido anticipado' })
  list(@Param('businessId') businessId: string) {
    return unwrap(this.settings.list(businessId));
  }

  @Post('sucursales/:sucursalId/pedido-anticipado')
  @ApiOperation({ summary: 'Activar el pedido anticipado de la sucursal (idempotente: mismo link)' })
  enable(@Param('businessId') businessId: string, @Param('sucursalId') sucursalId: string) {
    return unwrap(this.settings.enable(businessId, sucursalId));
  }

  @Delete('sucursales/:sucursalId/pedido-anticipado')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desactivar el pedido anticipado de la sucursal (el link deja de funcionar)' })
  async disable(@Param('businessId') businessId: string, @Param('sucursalId') sucursalId: string): Promise<void> {
    await unwrap(this.settings.disable(businessId, sucursalId));
  }
}
