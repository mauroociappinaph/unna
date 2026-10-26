import { Inject, Injectable } from '@nestjs/common';
import { MercadoPagoConnectionRepositoryPort, MercadoPagoSucursal } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

export interface MercadoPagoSucursalQr {
  sucursalId: string;
  ready: boolean;
  qrImageUrl: string | null;
  qrTemplateUrl: string | null;
}

export interface MercadoPagoStatus {
  connected: boolean;
  mpUserId: string | null;
  liveMode: boolean | null;
  connectedAt: string | null;
  sucursales: Array<MercadoPagoSucursalQr & { name: string }>;
}

/** The sucursal's printed QR, as the API shows it: ready once its POS exists. */
export function toSucursalQr(sucursal: MercadoPagoSucursal): MercadoPagoSucursalQr {
  return {
    sucursalId: sucursal.id,
    ready: sucursal.mpPosId !== null,
    qrImageUrl: sucursal.qrImageUrl,
    qrTemplateUrl: sucursal.qrTemplateUrl,
  };
}

/** Mercado Pago connection status and disconnection (S15). Tokens never leave the repository. */
@Injectable()
export class MercadoPagoConnectionUseCase {
  constructor(
    @Inject('MercadoPagoConnectionRepositoryPort')
    private readonly repository: MercadoPagoConnectionRepositoryPort,
  ) {}

  async status(businessId: string): Promise<UseCaseResult<MercadoPagoStatus>> {
    const [connection, sucursales] = await Promise.all([this.repository.findConnection(businessId), this.repository.listSucursales(businessId)]);
    return {
      ok: true,
      value: {
        connected: connection !== null,
        mpUserId: connection?.mpUserId ?? null,
        liveMode: connection?.liveMode ?? null,
        connectedAt: connection?.connectedAt.toISOString() ?? null,
        sucursales: sucursales.map((s) => ({ ...toSucursalQr(s), name: s.name })),
      },
    };
  }

  /** Removes the tokens and the sucursales' store/POS links. Idempotent. */
  async disconnect(businessId: string): Promise<UseCaseResult<void>> {
    await this.repository.deleteConnection(businessId);
    return { ok: true, value: undefined };
  }
}
