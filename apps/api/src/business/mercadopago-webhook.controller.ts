import { Controller, Headers, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { verifyMercadoPagoWebhookSignature } from './adapters/mercadopago/mercadopago-webhook-signature';
import { QrChargeSync } from './use-cases/qr-charge-sync';

const INVALID_SIGNATURE = 'Firma de Mercado Pago inválida';

/**
 * Public Mercado Pago notifications (S15). No session: the x-signature (MP_WEBHOOK_SECRET) is the
 * credential and is checked before any data is read, so rejecting is cheap. The body is never read:
 * the signed `data.id` of the query names the order, which is then read from Mercado Pago with the
 * connection of the charge's business. Valid notifications always get 200 (even for unknown orders
 * or a failed sync, which the POS polling settles), so Mercado Pago does not retry them.
 */
@ApiTags('Mercado Pago')
@Controller('public/mercadopago')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(private readonly sync: QrChargeSync) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async notify(
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') dataId: unknown,
  ): Promise<void> {
    const mpOrderId = typeof dataId === 'string' && dataId !== '' ? dataId : undefined;
    const valid = verifyMercadoPagoWebhookSignature({
      signature: asString(signature),
      requestId: asString(requestId),
      dataId: mpOrderId,
      secret: process.env.MP_WEBHOOK_SECRET,
    });
    if (!valid) throw new UnauthorizedException(INVALID_SIGNATURE);
    if (!mpOrderId) return;

    try {
      await this.sync.syncByMpOrderId(mpOrderId);
    } catch (error) {
      // Only the message: it never carries tokens (see MercadoPagoHttpAdapter).
      this.logger.warn(`No se pudo sincronizar la orden ${mpOrderId} de Mercado Pago: ${(error as Error).message}`);
    }
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
