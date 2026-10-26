import { MercadoPagoAccessTokenProvider } from '../mercadopago-access-token.provider';
import { BUSINESS, DAY_MS, fakeGateway, InMemoryMercadoPagoRepository, NOW, testCipher } from './mercadopago-fakes';

const setup = (expiresInMs: number) => {
  const repo = new InMemoryMercadoPagoRepository();
  const gateway = fakeGateway();
  const cipher = testCipher();
  repo.connections.set(BUSINESS, {
    businessId: BUSINESS, mpUserId: '987654321', liveMode: true, scope: 'offline_access read write',
    encryptedAccessToken: cipher.encrypt('APP_USR-access-1'), encryptedRefreshToken: cipher.encrypt('TG-refresh-1'),
    accessTokenExpiresAt: new Date(NOW.getTime() + expiresInMs), connectedAt: NOW,
  });
  return { repo, gateway, cipher, provider: new MercadoPagoAccessTokenProvider(repo, gateway, cipher) };
};

describe('MercadoPagoAccessTokenProvider (S15)', () => {
  it('returns the stored token while it expires later than 7 days from now', async () => {
    const { provider, gateway } = setup(8 * DAY_MS);
    await expect(provider.validAccessToken(BUSINESS, NOW)).resolves.toEqual({ ok: true, value: 'APP_USR-access-1' });
    expect(gateway.refreshToken).not.toHaveBeenCalled();
  });

  it('refreshes within 7 days of expiry and stores the new tokens (refresh tokens are single use) encrypted', async () => {
    const { provider, gateway, repo, cipher } = setup(7 * DAY_MS);
    await expect(provider.validAccessToken(BUSINESS, NOW)).resolves.toEqual({ ok: true, value: 'APP_USR-access-2' });
    expect(gateway.refreshToken).toHaveBeenCalledWith('TG-refresh-1');

    const stored = repo.connections.get(BUSINESS)!;
    expect(cipher.decrypt(stored.encryptedRefreshToken)).toBe('TG-refresh-2');
    expect(cipher.decrypt(stored.encryptedAccessToken)).toBe('APP_USR-access-2');
    expect(JSON.stringify(stored)).not.toMatch(/APP_USR-access-2|TG-refresh-2/);
    expect(stored.accessTokenExpiresAt).toEqual(new Date(NOW.getTime() + 180 * DAY_MS));
  });

  it('shares one refresh between concurrent callers of the same business', async () => {
    const { provider, gateway } = setup(DAY_MS);
    const results = await Promise.all([provider.validAccessToken(BUSINESS, NOW), provider.validAccessToken(BUSINESS, NOW)]);
    expect(results.map((r) => r.value)).toEqual(['APP_USR-access-2', 'APP_USR-access-2']);
    expect(gateway.refreshToken).toHaveBeenCalledTimes(1);
  });

  it('asks to reconnect when the refresh fails, keeping the stored tokens and hiding the cause', async () => {
    const { provider, gateway, repo } = setup(-DAY_MS);
    const before = { ...repo.connections.get(BUSINESS)! };
    gateway.refreshToken.mockRejectedValueOnce(new Error('Mercado Pago respondió 400 (invalid_grant)'));
    const result = await provider.validAccessToken(BUSINESS, NOW);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe('No se pudo renovar la conexión con Mercado Pago: volvé a conectar la cuenta');
    expect(repo.connections.get(BUSINESS)).toEqual(before);
  });

  it('fails with the contract message when the business is not connected', async () => {
    const { provider, repo } = setup(8 * DAY_MS);
    repo.connections.clear();
    const result = await provider.validAccessToken(BUSINESS, NOW);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe('Conectá tu cuenta de Mercado Pago');
  });
});
