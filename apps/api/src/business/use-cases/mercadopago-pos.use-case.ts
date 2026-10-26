import { Inject, Injectable } from '@nestjs/common';
import {
  MERCADOPAGO_PROVISIONING_STALE_MS,
  mercadoPagoExternalIds,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoGatewayPort,
  MercadoPagoSucursal,
  NotFoundError,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { MercadoPagoAccessTokenProvider, MERCADOPAGO_NOT_CONNECTED } from './mercadopago-access-token.provider';
import { MercadoPagoSucursalQr, toSucursalQr } from './mercadopago-connection.use-case';
import { stableIdempotencyKey } from './mercadopago-idempotency-key';

const SUCURSAL_NOT_FOUND = 'Sucursal no encontrada';
const PROVISIONING_IN_PROGRESS = 'Ya se está activando el cobro QR en esta sucursal. Probá de nuevo en unos segundos';

/**
 * "Activar cobro QR" of a sucursal (S15): creates its Mercado Pago store (from the sucursal address)
 * and POS once. The store id is saved before creating the POS, so a retry after a POS failure
 * reuses it; an already provisioned sucursal returns its QR without calling Mercado Pago. Concurrent
 * requests for the same sucursal are serialized by a provisioning claim: only its holder calls
 * Mercado Pago, so a single store and POS are created.
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

  async provision(businessId: string, sucursalId: string, now = new Date()): Promise<UseCaseResult<MercadoPagoSucursalQr>> {
    const sucursal = await this.repository.findSucursal(businessId, sucursalId);
    if (!sucursal) return { ok: false, error: new NotFoundError(SUCURSAL_NOT_FOUND) };

    const connection = await this.repository.findConnection(businessId);
    if (!connection) return { ok: false, error: new Error(MERCADOPAGO_NOT_CONNECTED) };
    if (sucursal.mpPosId) return { ok: true, value: toSucursalQr(sucursal) };

    const staleBefore = new Date(now.getTime() - MERCADOPAGO_PROVISIONING_STALE_MS);
    if (!(await this.repository.claimSucursalProvisioning(businessId, sucursalId, now, staleBefore))) {
      const latest = await this.repository.findSucursal(businessId, sucursalId);
      if (latest?.mpPosId) return { ok: true, value: toSucursalQr(latest) };
      return { ok: false, error: new Error(PROVISIONING_IN_PROGRESS) };
    }
    try {
      // Re-read under the claim: an earlier attempt may have saved the store before failing.
      const claimed = (await this.repository.findSucursal(businessId, sucursalId)) ?? sucursal;
      if (claimed.mpPosId) return { ok: true, value: toSucursalQr(claimed) };
      return await this.createStoreAndPos(claimed, connection.mpUserId);
    } finally {
      await this.repository.releaseSucursalProvisioning(businessId, sucursalId);
    }
  }

  private async createStoreAndPos(sucursal: MercadoPagoSucursal, mpUserId: string): Promise<UseCaseResult<MercadoPagoSucursalQr>> {
    const { businessId } = sucursal;
    const token = await this.tokens.validAccessToken(businessId);
    if (!token.ok) return { ok: false, error: token.error };
    const accessToken = token.value as string;

    const externalIds = mercadoPagoExternalIds(sucursal.id);
    let storeId = sucursal.mpStoreId;
    if (!storeId) {
      ({ id: storeId } = await this.gateway.createStore(accessToken, {
        mpUserId,
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
