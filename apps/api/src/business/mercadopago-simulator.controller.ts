import { Controller, HttpCode, Inject, NotFoundException, Param, Post, Type } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { MercadoPagoGatewayPort } from '@unna/domain';
import { isMercadoPagoConfigured } from './adapters/mercadopago/mercadopago.config';
import { MercadoPagoSimulatorAdapter } from './adapters/mercadopago/mercadopago-simulator.adapter';
import { QrChargeSync } from './use-cases/qr-charge-sync';
import { QrChargeView, toQrChargeView } from './use-cases/qr-charge.view';

const NOT_PAYABLE = 'Orden simulada no encontrada o ya no está pendiente';

/**
 * Development only (S15): plays the buyer paying a simulated QR order, then runs the same sync as
 * the webhook. Registered only when the simulator is wired outside production
 * (mercadoPagoSimulatorControllers); it also answers 404 if it ever runs with the real gateway or
 * in production.
 */
@ApiExcludeController()
@Controller('mercadopago/simulator')
export class MercadoPagoSimulatorController {
  constructor(
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
    private readonly sync: QrChargeSync,
  ) {}

  @Post('orders/:mpOrderId/pay')
  @HttpCode(200)
  async pay(@Param('mpOrderId') mpOrderId: string): Promise<QrChargeView> {
    if (!(this.gateway instanceof MercadoPagoSimulatorAdapter) || process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    if (!this.gateway.markPaid(mpOrderId)) throw new NotFoundException(NOT_PAYABLE);
    const charge = await this.sync.syncByMpOrderId(mpOrderId);
    if (!charge) throw new NotFoundException('Cobro QR no encontrado');
    return toQrChargeView(charge);
  }
}

/** The simulator route exists only with the simulator (no MP_CLIENT_ID/SECRET) outside production. */
export function mercadoPagoSimulatorControllers(env: NodeJS.ProcessEnv = process.env): Type[] {
  return !isMercadoPagoConfigured(env) && env.NODE_ENV !== 'production' ? [MercadoPagoSimulatorController] : [];
}
