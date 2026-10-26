import { Controller, Delete, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import type { MercadoPagoGatewayPort } from '@unna/domain';
import { QrChargeUseCase } from './use-cases/qr-charge.use-case';
import type { QrChargeView } from './use-cases/qr-charge.view';
import { MercadoPagoSimulatorAdapter } from './adapters/mercadopago/mercadopago-simulator.adapter';

/** QR charges of the POS with Mercado Pago (S15). */
@ApiTags('Mercado Pago')
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class QrChargeController {
  constructor(
    private readonly qrCharges: QrChargeUseCase,
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
  ) {}

  @Post('orders/:orderId/qr-charge')
  @ApiOperation({ summary: 'Cobrar con QR el saldo pendiente (devuelve el cobro pendiente si ya existe)' })
  create(@Param('businessId') businessId: string, @Param('orderId') orderId: string) {
    return this.withMode(unwrap(this.qrCharges.create(businessId, orderId)));
  }

  @Get('qr-charges/:chargeId')
  @ApiOperation({ summary: 'Estado del cobro QR (se sincroniza con Mercado Pago)' })
  get(@Param('businessId') businessId: string, @Param('chargeId') chargeId: string) {
    return this.withMode(unwrap(this.qrCharges.get(businessId, chargeId)));
  }

  @Delete('qr-charges/:chargeId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar un cobro QR pendiente (si ya se pagó, devuelve el cobro pagado)' })
  cancel(@Param('businessId') businessId: string, @Param('chargeId') chargeId: string) {
    return unwrap(this.qrCharges.cancel(businessId, chargeId));
  }

  /** `simulated` lets the POS offer "Simular pago" while the Mercado Pago simulator is wired. */
  private async withMode(pending: Promise<QrChargeView>): Promise<QrChargeView & { simulated: boolean }> {
    return { ...(await pending), simulated: this.gateway instanceof MercadoPagoSimulatorAdapter };
  }
}
