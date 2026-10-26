import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  mercadoPagoExternalIds,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoGatewayPort,
  MercadoPagoSucursal,
  NotFoundError,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { MercadoPagoAccessTokenProvider, MERCADOPAGO_NOT_CONNECTED } from './mercadopago-access-token.provider';
import { MercadoPagoSucursalQr, toSucursalQr } from './mercadopago-connection.use-case';

const SUCURSAL_NOT_FOUND = 'Sucursal no encontrada';

/** UUID-shaped key derived from `seed`, so a retried request reuses the same X-Idempotency-Key. */
function stableIdempotencyKey(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * "Activar cobro QR" of a sucursal (S15): creates its Mercado Pago store (from the sucursal address)
 * and POS once. The store id is saved before creating the POS, so a retry after a POS failure
 * reuses it; an already provisioned sucursal returns its QR without calling Mercado Pago.
 */
@Injectable()
export class MercadoPagoPosUseCase {
  constructor(
    @Inject('MercadoPagoConnectionRepositoryPort')
    private readonly repository: MercadoPagoConnectionRepositoryPort,
    @Inject('MercadoPagoGatewayPort')
    private readonly gateway: MercadoPagoGatewayPort,
    private readonly tokens: MercadoPagoAccessTokenProvider,
  ) {}

  async provision(businessId: string, sucursalId: string): Promise<UseCaseResult<MercadoPagoSucursalQr>> {
    const sucursal = await this.repository.findSucursal(businessId, sucursalId);
    if (!sucursal) return { ok: false, error: new NotFoundError(SUCURSAL_NOT_FOUND) };

    const connection = await this.repository.findConnection(businessId);
    if (!connection) return { ok: false, error: new Error(MERCADOPAGO_NOT_CONNECTED) };
    if (sucursal.mpPosId) return { ok: true, value: toSucursalQr(sucursal) };

    const token = await this.tokens.validAccessToken(businessId);
    if (!token.ok) return { ok: false, error: token.error };
    const accessToken = token.value as string;

    const externalIds = mercadoPagoExternalIds(sucursal.id);
    let storeId = sucursal.mpStoreId;
    if (!storeId) {
      ({ id: storeId } = await this.gateway.createStore(accessToken, {
        mpUserId: connection.mpUserId,
        name: sucursal.name,
        externalId: externalIds.storeExternalId,
        location: storeLocation(sucursal),
      }));
      await this.repository.saveSucursalStore(businessId, sucursal.id, storeId);
    }

    const pos = await this.gateway.createPos(accessToken, {
      name: sucursal.name,
      storeId,
      externalId: externalIds.posExternalId,
      idempotencyKey: stableIdempotencyKey(`pos:${storeId}:${externalIds.posExternalId}`),
    });
    const link = { mpPosId: pos.id, mpPosExternalId: pos.externalId, qrImageUrl: pos.qrImageUrl, qrTemplateUrl: pos.qrTemplateUrl };
    await this.repository.saveSucursalPos(businessId, sucursal.id, link);
    return { ok: true, value: toSucursalQr({ ...sucursal, mpStoreId: storeId, ...link }) };
  }
}

function storeLocation(sucursal: MercadoPagoSucursal) {
  const { address } = sucursal;
  return {
    streetName: address.street,
    streetNumber: address.number,
    cityName: address.city,
    stateName: address.province,
    ...(address.neighborhood && { reference: address.neighborhood }),
  };
}
