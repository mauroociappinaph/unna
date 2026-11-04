// Persistence of the Mercado Pago connection (S15). Every secret field holds ciphertext produced by
// SecretCipherPort; adapters store and return it as is.

export interface MercadoPagoConnectionRecord {
  businessId: string;
  mpUserId: string;
  liveMode: boolean;
  scope: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  accessTokenExpiresAt: Date;
  connectedAt: Date;
}

export interface MercadoPagoTokenUpdate {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  accessTokenExpiresAt: Date;
  scope: string;
}

/** A started OAuth attempt; only the SHA-256 of its state is stored. */
export interface MercadoPagoOAuthAttempt {
  stateHash: string;
  businessId: string;
  ownerId: string;
  encryptedCodeVerifier: string;
  expiresAt: Date;
}

export interface MercadoPagoSucursal {
  id: string;
  businessId: string;
  name: string;
  address: { street: string; number: string; city: string; province: string; neighborhood?: string };
  mpStoreId: string | null;
  mpPosId: string | null;
  mpPosExternalId: string | null;
  qrImageUrl: string | null;
  qrTemplateUrl: string | null;
}

export interface MercadoPagoPosLink {
  mpPosId: string;
  mpPosExternalId: string;
  qrImageUrl: string;
  qrTemplateUrl: string;
}

export interface MercadoPagoConnectionRepositoryPort {
  findConnection(businessId: string): Promise<MercadoPagoConnectionRecord | null>;
  /**
   * Creates or replaces the business connection. Replacing it with another Mercado Pago account
   * clears the sucursales' store and POS links, which belong to the previous account.
   */
  saveConnection(connection: MercadoPagoConnectionRecord): Promise<void>;
  updateTokens(businessId: string, tokens: MercadoPagoTokenUpdate): Promise<void>;
  /** Removes the connection and every sucursal's store and POS links. */
  deleteConnection(businessId: string): Promise<void>;

  saveOAuthAttempt(attempt: MercadoPagoOAuthAttempt): Promise<void>;
  /** Deletes and returns the attempt with this state hash; null when none (or another call took it). */
  consumeOAuthAttempt(stateHash: string): Promise<MercadoPagoOAuthAttempt | null>;
  deleteExpiredOAuthAttempts(now: Date): Promise<void>;
  /** Owner of the business; null when it does not exist. */
  findBusinessOwnerId(businessId: string): Promise<string | null>;

  listSucursales(businessId: string): Promise<MercadoPagoSucursal[]>;
  /** Null when the sucursal does not exist or belongs to another business. */
  findSucursal(businessId: string, sucursalId: string): Promise<MercadoPagoSucursal | null>;
  saveSucursalStore(businessId: string, sucursalId: string, mpStoreId: string): Promise<void>;
  saveSucursalPos(businessId: string, sucursalId: string, pos: MercadoPagoPosLink): Promise<void>;
  /**
   * Atomically claims the store + POS provisioning of a sucursal without a POS, so concurrent
   * requests cannot create two stores. A claim taken before `staleBefore` counts as abandoned.
   * False when another request holds it (or the sucursal already has a POS).
   */
  claimSucursalProvisioning(businessId: string, sucursalId: string, now: Date, staleBefore: Date): Promise<boolean>;
  releaseSucursalProvisioning(businessId: string, sucursalId: string): Promise<void>;
}
