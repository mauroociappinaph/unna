import { FiscalAuthorizationRequest, FiscalAuthorizationResult, FiscalAuthorizerPort, FiscalReceiptType } from '@unna/domain';
import { ArcaConfig, loadArcaConfig } from './arca.config';
import { AccessTicketProvider, WsaaClient } from './wsaa.client';
import { WsfeAuth, WsfeClient } from './wsfe.client';

/**
 * Real ARCA (S12, T30f): WSAA logs in with UNNA's single certificate and WSFEv1 authorizes each
 * receipt with Auth.Cuit = the café's CUIT, which works because every café delegates "wsfe" to UNNA.
 */
export class ArcaFiscalAuthorizerAdapter implements FiscalAuthorizerPort {
  constructor(
    private readonly tickets: AccessTicketProvider,
    private readonly wsfe: WsfeClient,
  ) {}

  static fromConfig(config: ArcaConfig, now?: () => Date): ArcaFiscalAuthorizerAdapter {
    return new ArcaFiscalAuthorizerAdapter(
      new WsaaClient({
        url: config.wsaaUrl,
        certificatePem: config.certificatePem,
        privateKeyPem: config.privateKeyPem,
        timeoutMs: config.timeoutMs,
        now,
      }),
      new WsfeClient({ url: config.wsfeUrl, timeoutMs: config.timeoutMs }),
    );
  }

  async lastAuthorizedNumber(issuerCuit: string, pointOfSale: number, receiptType: FiscalReceiptType): Promise<number> {
    return this.wsfe.lastAuthorized(await this.auth(issuerCuit), pointOfSale, receiptType);
  }

  async authorize(request: FiscalAuthorizationRequest): Promise<FiscalAuthorizationResult> {
    return this.wsfe.requestCae(await this.auth(request.issuerCuit), request);
  }

  private async auth(issuerCuit: string): Promise<WsfeAuth> {
    const { token, sign } = await this.tickets.getTicket();
    return { token, sign, cuit: issuerCuit };
  }
}

/** Reads and validates the ARCA_* environment once; throws when it is incomplete or invalid. */
export function createArcaFiscalAuthorizer(env: NodeJS.ProcessEnv = process.env): ArcaFiscalAuthorizerAdapter {
  return ArcaFiscalAuthorizerAdapter.fromConfig(loadArcaConfig(env));
}
