import { randomBytes } from 'crypto';
import {
  CreateMercadoPagoPosRequest,
  MercadoPagoConnectionRecord,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoGatewayPort,
  MercadoPagoOAuthAttempt,
  MercadoPagoPos,
  MercadoPagoSucursal,
  MercadoPagoTokens,
} from '@unna/domain';
import { AesGcmSecretCipher } from '../../adapters/mercadopago/aes-gcm-secret-cipher';

export const OWNER = 'owner-A';
export const BUSINESS = 'biz-A';
export const NOW = new Date('2026-10-25T12:00:00Z');
export const DAY_MS = 24 * 60 * 60 * 1000;

export const sucursal = (overrides: Partial<MercadoPagoSucursal> = {}): MercadoPagoSucursal => ({
  id: 'suc-1',
  businessId: BUSINESS,
  name: 'Palermo',
  address: { street: 'Honduras', number: '5000', city: 'CABA', province: 'Buenos Aires', neighborhood: 'Palermo' },
  mpStoreId: null,
  mpPosId: null,
  mpPosExternalId: null,
  qrImageUrl: null,
  qrTemplateUrl: null,
  ...overrides,
});

export const tokens = (overrides: Partial<MercadoPagoTokens> = {}): MercadoPagoTokens => ({
  accessToken: 'APP_USR-access-1',
  refreshToken: 'TG-refresh-1',
  expiresInSeconds: 15552000,
  scope: 'offline_access read write',
  mpUserId: '987654321',
  liveMode: true,
  ...overrides,
});

/** In-memory repository with the same single-use and tenant rules the Prisma adapter enforces. */
export class InMemoryMercadoPagoRepository implements MercadoPagoConnectionRepositoryPort {
  connections = new Map<string, MercadoPagoConnectionRecord>();
  attempts = new Map<string, MercadoPagoOAuthAttempt>();
  owners = new Map<string, string>([[BUSINESS, OWNER], ['biz-B', 'owner-B']]);
  sucursales: MercadoPagoSucursal[] = [sucursal(), sucursal({ id: 'suc-B', businessId: 'biz-B', name: 'Otro café' })];
  /** Provisioning claims per sucursal id, like the Sucursal.mpProvisioningAt column. */
  provisioningClaims = new Map<string, Date>();

  async findConnection(businessId: string) {
    return this.connections.get(businessId) ?? null;
  }
  async saveConnection(connection: MercadoPagoConnectionRecord) {
    const previous = this.connections.get(connection.businessId);
    if (previous && previous.mpUserId !== connection.mpUserId) this.clearLinks(connection.businessId);
    this.connections.set(connection.businessId, { ...connection });
  }
  async updateTokens(businessId: string, update: Parameters<MercadoPagoConnectionRepositoryPort['updateTokens']>[1]) {
    const current = this.connections.get(businessId);
    if (current) this.connections.set(businessId, { ...current, ...update });
  }
  async deleteConnection(businessId: string) {
    this.connections.delete(businessId);
    this.clearLinks(businessId);
  }
  async saveOAuthAttempt(attempt: MercadoPagoOAuthAttempt) {
    this.attempts.set(attempt.stateHash, { ...attempt });
  }
  async consumeOAuthAttempt(stateHash: string) {
    const attempt = this.attempts.get(stateHash) ?? null;
    this.attempts.delete(stateHash);
    return attempt;
  }
  async deleteExpiredOAuthAttempts(now: Date) {
    for (const [hash, attempt] of this.attempts) if (attempt.expiresAt <= now) this.attempts.delete(hash);
  }
  async findBusinessOwnerId(businessId: string) {
    return this.owners.get(businessId) ?? null;
  }
  async listSucursales(businessId: string) {
    return this.sucursales.filter((s) => s.businessId === businessId).map((s) => ({ ...s }));
  }
  async findSucursal(businessId: string, sucursalId: string) {
    const found = this.sucursales.find((s) => s.businessId === businessId && s.id === sucursalId);
    return found ? { ...found } : null;
  }
  async saveSucursalStore(businessId: string, sucursalId: string, mpStoreId: string) {
    this.patch(businessId, sucursalId, { mpStoreId });
  }
  async saveSucursalPos(businessId: string, sucursalId: string, pos: Parameters<MercadoPagoConnectionRepositoryPort['saveSucursalPos']>[2]) {
    this.patch(businessId, sucursalId, pos);
  }

  /** Check-and-set in one synchronous step, like the conditional UPDATE of the Prisma adapter. */
  async claimSucursalProvisioning(businessId: string, sucursalId: string, now: Date, staleBefore: Date) {
    const found = this.sucursales.find((s) => s.businessId === businessId && s.id === sucursalId);
    const claim = this.provisioningClaims.get(sucursalId);
    if (!found || found.mpPosId || (claim && claim >= staleBefore)) return false;
    this.provisioningClaims.set(sucursalId, now);
    return true;
  }
  async releaseSucursalProvisioning(businessId: string, sucursalId: string) {
    if (this.sucursales.some((s) => s.businessId === businessId && s.id === sucursalId)) this.provisioningClaims.delete(sucursalId);
  }

  private patch(businessId: string, sucursalId: string, data: Partial<MercadoPagoSucursal>) {
    this.sucursales = this.sucursales.map((s) => (s.businessId === businessId && s.id === sucursalId ? { ...s, ...data } : s));
  }
  private clearLinks(businessId: string) {
    this.sucursales = this.sucursales.map((s) =>
      s.businessId === businessId ? { ...s, mpStoreId: null, mpPosId: null, mpPosExternalId: null, qrImageUrl: null, qrTemplateUrl: null } : s,
    );
  }
}

export const fakeGateway = () => ({
  buildAuthorizationUrl: jest.fn(({ state, codeChallenge }: { state: string; codeChallenge: string }) =>
    `https://auth.mercadopago.com/authorization?state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`),
  exchangeCode: jest.fn<Promise<MercadoPagoTokens>, [{ code: string; codeVerifier: string }]>(async () => tokens()),
  refreshToken: jest.fn<Promise<MercadoPagoTokens>, [string]>(async () => tokens({ accessToken: 'APP_USR-access-2', refreshToken: 'TG-refresh-2' })),
  createStore: jest.fn(async () => ({ id: 'store-1' })),
  createPos: jest.fn<Promise<MercadoPagoPos>, [string, CreateMercadoPagoPosRequest]>(async (_token, request) => ({
    id: 'pos-1', externalId: request.externalId, qrImageUrl: 'https://mp/qr.png', qrTemplateUrl: 'https://mp/qr.pdf',
  })),
  createQrOrder: jest.fn(),
  getOrder: jest.fn(),
  cancelOrder: jest.fn(),
}) satisfies MercadoPagoGatewayPort;

export const testCipher = () => new AesGcmSecretCipher(randomBytes(32));
