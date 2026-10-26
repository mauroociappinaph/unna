import { Controller, Get, Inject, NotFoundException, Param, Redirect, Type } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { MercadoPagoGatewayPort } from '@unna/domain';
import { assertSimulator, mercadoPagoSimulatorWired } from './mercadopago-simulator.controller';
import { OnlineCheckoutSync } from './use-cases/online-checkout-sync';

const NOT_PAYABLE = 'Pago simulado no encontrado';

/**
 * Development only (S20): the simulated Mercado Pago checkout of a pedido anticipado, where the
 * simulator's `checkout_url` points. Plays the buyer paying, runs the same sync as the webhook and
 * sends the buyer back to the tracking page (302 to the success URL). Registered only while the
 * simulator is wired (onlineCheckoutSimulatorControllers); it also answers 404 if it ever runs with
 * the real gateway or in production without staging.
 */
@ApiExcludeController()
@Controller('mercadopago/simulator')
export class MercadoPagoSimulatorCheckoutController {
  constructor(
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
    private readonly sync: OnlineCheckoutSync,
  ) {}

  @Get('checkout/:mpOrderId')
  @Redirect()
  async pay(@Param('mpOrderId') mpOrderId: string): Promise<{ url: string; statusCode: number }> {
    const { gateway } = this;
    assertSimulator(gateway);
    const successUrl = gateway.successUrlOf(mpOrderId);
    if (!successUrl) throw new NotFoundException(NOT_PAYABLE);
    // Opening the checkout again after paying only syncs and redirects.
    if (!gateway.markPaid(mpOrderId) && (await gateway.getOrder('', mpOrderId)).status !== 'processed') throw new NotFoundException(NOT_PAYABLE);
    if (!(await this.sync.syncByMpOrderId(mpOrderId))) throw new NotFoundException(NOT_PAYABLE);
    return { url: successUrl, statusCode: 302 };
  }
}

/** Registered only while the Mercado Pago simulator is wired (outside production or in staging). */
export function onlineCheckoutSimulatorControllers(env: NodeJS.ProcessEnv = process.env): Type[] {
  return mercadoPagoSimulatorWired(env) ? [MercadoPagoSimulatorCheckoutController] : [];
}
