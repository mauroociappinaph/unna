import { Controller, HttpCode, Inject, NotFoundException, Param, Post, Type, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { MercadoPagoGatewayPort, QrChargeRepositoryPort } from '@unna/domain';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { simulatorsAllowed } from '../common/runtime-env';
import { isMercadoPagoConfigured } from './adapters/mercadopago/mercadopago.config';
import { MercadoPagoSimulatorAdapter } from './adapters/mercadopago/mercadopago-simulator.adapter';
import { QrChargeSync } from './use-cases/qr-charge-sync';
import { QrChargeView, toQrChargeView } from './use-cases/qr-charge.view';

const NOT_PAYABLE = 'Orden simulada no encontrada o ya no está pendiente';

/**
 * Development only (S15): plays the buyer paying a simulated QR order, then runs the same sync as
 * the webhook. Registered only when the simulator is wired outside production or in staging
 * (mercadoPagoSimulatorControllers); it also answers 404 if it ever runs with the real gateway or
 * in production without staging.
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
    return paySimulatedOrder(this.gateway, this.sync, mpOrderId);
  }
}

/**
 * Development only (S15): the POS "Simular pago" button. Same as the route above, but by charge id
 * and scoped to the business of the owner, so the web never needs the Mercado Pago order id.
 */
@ApiExcludeController()
@Controller('mercadopago/simulator/businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
export class MercadoPagoSimulatorOwnerController {
  constructor(
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
    @Inject('QrChargeRepositoryPort') private readonly charges: Pick<QrChargeRepositoryPort, 'findById'>,
    private readonly sync: QrChargeSync,
  ) {}

  @Post('qr-charges/:chargeId/pay')
  @HttpCode(200)
  async pay(@Param('businessId') businessId: string, @Param('chargeId') chargeId: string): Promise<QrChargeView & { simulated: true }> {
    assertSimulator(this.gateway);
    const charge = await this.charges.findById(businessId, chargeId);
    if (!charge) throw new NotFoundException('Cobro QR no encontrado');
    return { ...(await paySimulatedOrder(this.gateway, this.sync, charge.mpOrderId)), simulated: true };
  }
}

function assertSimulator(gateway: MercadoPagoGatewayPort): asserts gateway is MercadoPagoSimulatorAdapter {
  if (!(gateway instanceof MercadoPagoSimulatorAdapter) || !simulatorsAllowed()) {
    throw new NotFoundException();
  }
}

async function paySimulatedOrder(gateway: MercadoPagoGatewayPort, sync: QrChargeSync, mpOrderId: string): Promise<QrChargeView> {
  assertSimulator(gateway);
  if (!gateway.markPaid(mpOrderId)) throw new NotFoundException(NOT_PAYABLE);
  const charge = await sync.syncByMpOrderId(mpOrderId);
  if (!charge) throw new NotFoundException('Cobro QR no encontrado');
  return toQrChargeView(charge);
}

/** The simulator routes exist only with the simulator (no MP_CLIENT_ID/SECRET) outside production or in staging. */
export function mercadoPagoSimulatorControllers(env: NodeJS.ProcessEnv = process.env): Type[] {
  return !isMercadoPagoConfigured(env) && simulatorsAllowed(env) ? [MercadoPagoSimulatorController, MercadoPagoSimulatorOwnerController] : [];
}
