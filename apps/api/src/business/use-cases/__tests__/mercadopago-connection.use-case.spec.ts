import { MercadoPagoConnectionUseCase } from '../mercadopago-connection.use-case';
import { BUSINESS, InMemoryMercadoPagoRepository, NOW, sucursal, testCipher } from './mercadopago-fakes';

const connect = (repo: InMemoryMercadoPagoRepository) => {
  const cipher = testCipher();
  repo.connections.set(BUSINESS, {
    businessId: BUSINESS, mpUserId: '987654321', liveMode: true, scope: 'offline_access read write',
    encryptedAccessToken: cipher.encrypt('APP_USR-access-1'), encryptedRefreshToken: cipher.encrypt('TG-refresh-1'),
    accessTokenExpiresAt: new Date('2027-04-23T12:00:00Z'), connectedAt: NOW,
  });
};

describe('MercadoPagoConnectionUseCase (S15)', () => {
  it('reports a business that is not connected, with its sucursales not ready', async () => {
    const repo = new InMemoryMercadoPagoRepository();
    const result = await new MercadoPagoConnectionUseCase(repo).status(BUSINESS);
    expect(result).toEqual({
      ok: true,
      value: {
        connected: false, mpUserId: null, liveMode: null, connectedAt: null,
        sucursales: [{ sucursalId: 'suc-1', name: 'Palermo', ready: false, qrImageUrl: null, qrTemplateUrl: null }],
      },
    });
  });

  it('reports the connection and each sucursal QR, with exactly the contract fields and no tokens', async () => {
    const repo = new InMemoryMercadoPagoRepository();
    connect(repo);
    repo.sucursales.push(sucursal({
      id: 'suc-2', name: 'Centro', mpStoreId: 'store-2', mpPosId: 'pos-2', mpPosExternalId: 'UNNAPsuc2',
      qrImageUrl: 'https://mp/qr.png', qrTemplateUrl: 'https://mp/qr.pdf',
    }));
    const result = await new MercadoPagoConnectionUseCase(repo).status(BUSINESS);
    expect(result.value).toEqual({
      connected: true, mpUserId: '987654321', liveMode: true, connectedAt: NOW.toISOString(),
      sucursales: [
        { sucursalId: 'suc-1', name: 'Palermo', ready: false, qrImageUrl: null, qrTemplateUrl: null },
        { sucursalId: 'suc-2', name: 'Centro', ready: true, qrImageUrl: 'https://mp/qr.png', qrTemplateUrl: 'https://mp/qr.pdf' },
      ],
    });
    expect(JSON.stringify(result.value)).not.toMatch(/APP_USR|TG-refresh|v1\./);
  });

  it('disconnects: removes the tokens and every sucursal store/POS link of that business only', async () => {
    const repo = new InMemoryMercadoPagoRepository();
    connect(repo);
    repo.sucursales = repo.sucursales.map((s) => ({ ...s, mpStoreId: 'store', mpPosId: 'pos', mpPosExternalId: `UNNAP${s.id}`, qrImageUrl: 'q', qrTemplateUrl: 't' }));
    const useCase = new MercadoPagoConnectionUseCase(repo);

    await expect(useCase.disconnect(BUSINESS)).resolves.toEqual({ ok: true, value: undefined });
    expect(repo.connections.has(BUSINESS)).toBe(false);
    expect(repo.sucursales.find((s) => s.id === 'suc-1')).toMatchObject({ mpStoreId: null, mpPosId: null, qrImageUrl: null });
    expect(repo.sucursales.find((s) => s.id === 'suc-B')).toMatchObject({ mpPosId: 'pos' });
    expect((await useCase.status(BUSINESS)).value?.connected).toBe(false);
  });
});
