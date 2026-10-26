import { Controller, Get, Header, Query, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { MercadoPagoAuthorizationUseCase, MercadoPagoCallbackOutcome } from './use-cases/mercadopago-authorization.use-case';

/** Dashboard page the owner returns to; only the outcome travels, never the code or the state. */
export function mercadoPagoReturnUrl(status: MercadoPagoCallbackOutcome, env: NodeJS.ProcessEnv = process.env): string {
  const frontend = (env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${frontend}/dashboard/mercadopago?status=${status}`;
}

/**
 * Public OAuth callback of Mercado Pago (S15). No session: the single-use state is the credential.
 * Always answers 302 to the dashboard; failures are not explained.
 */
@ApiTags('Mercado Pago')
@Controller('mercadopago/oauth')
export class MercadoPagoOAuthController {
  constructor(private readonly authorization: MercadoPagoAuthorizationUseCase) {}

  @Get('callback')
  @Redirect(undefined, 302)
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiExcludeEndpoint()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
  ): Promise<{ url: string; statusCode: number }> {
    let outcome: MercadoPagoCallbackOutcome = 'error';
    try {
      outcome = await this.authorization.complete({ code: asString(code), state: asString(state), error: asString(error) });
    } catch {
      outcome = 'error';
    }
    return { url: mercadoPagoReturnUrl(outcome), statusCode: 302 };
  }
}

/** Repeated query parameters arrive as arrays; only a single string counts. */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
