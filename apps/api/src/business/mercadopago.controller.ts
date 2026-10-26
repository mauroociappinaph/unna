import { Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import type { AuthenticatedRequest } from './authenticated-request';
import { MercadoPagoAuthorizationUseCase } from './use-cases/mercadopago-authorization.use-case';
import { MercadoPagoConnectionUseCase } from './use-cases/mercadopago-connection.use-case';
import { MercadoPagoPosUseCase } from './use-cases/mercadopago-pos.use-case';

/** Mercado Pago account of the business and cash register (POS) per sucursal (S15). */
@ApiTags('Mercado Pago')
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class MercadoPagoController {
  constructor(
    private readonly authorization: MercadoPagoAuthorizationUseCase,
    private readonly connection: MercadoPagoConnectionUseCase,
    private readonly pos: MercadoPagoPosUseCase,
  ) {}

  @Get('mercadopago')
  @ApiOperation({ summary: 'Estado de la conexión con Mercado Pago y QR de cada sucursal' })
  status(@Param('businessId') businessId: string) {
    return unwrap(this.connection.status(businessId));
  }

  @Post('mercadopago/connect')
  @ApiOperation({ summary: 'Iniciar "Conectar con Mercado Pago": devuelve la URL de autorización' })
  connect(@Param('businessId') businessId: string, @Request() req: AuthenticatedRequest) {
    return unwrap(this.authorization.connect(businessId, req.user.sub));
  }

  @Delete('mercadopago')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desconectar la cuenta de Mercado Pago (borra tokens y cajas)' })
  async disconnect(@Param('businessId') businessId: string): Promise<void> {
    await unwrap(this.connection.disconnect(businessId));
  }

  @Post('sucursales/:sucursalId/mercadopago/pos')
  @ApiOperation({ summary: 'Crear la tienda y la caja de Mercado Pago de la sucursal (idempotente)' })
  provisionPos(@Param('businessId') businessId: string, @Param('sucursalId') sucursalId: string) {
    return unwrap(this.pos.provision(businessId, sucursalId));
  }
}
