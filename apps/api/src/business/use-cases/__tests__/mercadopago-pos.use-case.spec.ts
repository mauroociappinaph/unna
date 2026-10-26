import { NotFoundError } from '@unna/domain';
import { MercadoPagoPosUseCase } from '../mercadopago-pos.use-case';
import { MercadoPagoAccessTokenProvider } from '../mercadopago-access-token.provider';
import { BUSINESS, fakeGateway, InMemoryMercadoPagoRepository, NOW, testCipher } from './mercadopago-fakes';

const setup = ({ connected = true } = {}) => {
  const repo = new InMemoryMercadoPagoRepository();
  const gateway = fakeGateway();
  const cipher = testCipher();
  if (connected) {
    repo.connections.set(BUSINESS, {
      businessId: BUSINESS, mpUserId: '987654321', liveMode: true, scope: 'offline_access read write',
      encryptedAccessToken: cipher.encrypt('APP_USR-access-1'), encryptedRefreshToken: cipher.encrypt('TG-refresh-1'),
      accessTokenExpiresAt: new Date('2027-04-23T12:00:00Z'), connectedAt: NOW,
    });
  }
  const tokens = new MercadoPagoAccessTokenProvider(repo, gateway, cipher);
  return { repo, gateway, useCase: new MercadoPagoPosUseCase(repo, gateway, tokens) };
};

describe('MercadoPagoPosUseCase (S15)', () => {
  it('creates the store from the sucursal address and its POS, and links them to the sucursal', async () => {
    const { useCase, gateway, repo } = setup();
    const result = await useCase.provision(BUSINESS, 'suc-1');
    expect(result).toEqual({ ok: true, value: { sucursalId: 'suc-1', ready: true, qrImageUrl: 'https://mp/qr.png', qrTemplateUrl: 'https://mp/qr.pdf' } });
    expect(gateway.createStore).toHaveBeenCalledWith('APP_USR-access-1', {
      mpUserId: '987654321', name: 'Palermo', externalId: 'UNNASsuc1',
      location: { streetName: 'Honduras', streetNumber: '5000', cityName: 'CABA', stateName: 'Buenos Aires', reference: 'Palermo' },
    });
    expect(gateway.createPos).toHaveBeenCalledWith('APP_USR-access-1', expect.objectContaining({ name: 'Palermo', storeId: 'store-1', externalId: 'UNNAPsuc1' }));
    expect(repo.sucursales.find((s) => s.id === 'suc-1')).toMatchObject({
      mpStoreId: 'store-1', mpPosId: 'pos-1', mpPosExternalId: 'UNNAPsuc1', qrImageUrl: 'https://mp/qr.png', qrTemplateUrl: 'https://mp/qr.pdf',
    });
  });

  it('is idempotent: a second call returns the same POS without calling Mercado Pago', async () => {
    const { useCase, gateway } = setup();
    const first = await useCase.provision(BUSINESS, 'suc-1');
    const second = await useCase.provision(BUSINESS, 'suc-1');
    expect(second).toEqual(first);
    expect(gateway.createStore).toHaveBeenCalledTimes(1);
    expect(gateway.createPos).toHaveBeenCalledTimes(1);
  });

  it('reuses the store when only the POS creation failed, with a stable idempotency key on retry', async () => {
    const { useCase, gateway } = setup();
    gateway.createPos.mockRejectedValueOnce(new Error('Mercado Pago respondió 500 (internal_error)'));
    await expect(useCase.provision(BUSINESS, 'suc-1')).rejects.toThrow('Mercado Pago respondió 500 (internal_error)');
    await expect(useCase.provision(BUSINESS, 'suc-1')).resolves.toMatchObject({ ok: true });
    expect(gateway.createStore).toHaveBeenCalledTimes(1);
    const keys = gateway.createPos.mock.calls.map((c) => c[1].idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('does not touch a sucursal of another business (404, nothing created or linked)', async () => {
    const { useCase, gateway, repo } = setup();
    const result = await useCase.provision(BUSINESS, 'suc-B');
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(result.error?.message).toBe('Sucursal no encontrada');
    expect(gateway.createStore).not.toHaveBeenCalled();
    expect(repo.sucursales.find((s) => s.id === 'suc-B')).toMatchObject({ mpStoreId: null, mpPosId: null });
  });

  describe('concurrent provisioning of the same sucursal', () => {
    const slowStore = (gateway: ReturnType<typeof fakeGateway>) => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      gateway.createStore.mockImplementationOnce(async () => {
        await gate;
        return { id: 'store-1' };
      });
      return () => release();
    };

    it('creates a single store and POS: the request that loses the claim does not call Mercado Pago', async () => {
      const { useCase, gateway } = setup();
      const finishStore = slowStore(gateway);

      const first = useCase.provision(BUSINESS, 'suc-1');
      const second = await useCase.provision(BUSINESS, 'suc-1');
      finishStore();

      expect(second).toEqual({ ok: false, error: new Error('Ya se está activando el cobro QR en esta sucursal. Probá de nuevo en unos segundos') });
      await expect(first).resolves.toMatchObject({ ok: true, value: { ready: true } });
      expect(gateway.createStore).toHaveBeenCalledTimes(1);
      expect(gateway.createPos).toHaveBeenCalledTimes(1);
      await expect(useCase.provision(BUSINESS, 'suc-1')).resolves.toEqual(await first);
    });

    it('releases the claim when Mercado Pago fails, so a retry can provision', async () => {
      const { useCase, gateway, repo } = setup();
      gateway.createStore.mockRejectedValueOnce(new Error('Mercado Pago respondió 500'));

      await expect(useCase.provision(BUSINESS, 'suc-1')).rejects.toThrow('Mercado Pago respondió 500');

      expect(repo.provisioningClaims.size).toBe(0);
      await expect(useCase.provision(BUSINESS, 'suc-1')).resolves.toMatchObject({ ok: true });
    });

    it('takes over a claim abandoned more than 2 minutes ago', async () => {
      const { useCase, repo } = setup();
      repo.provisioningClaims.set('suc-1', new Date(Date.now() - 2 * 60 * 1000 - 1000));

      await expect(useCase.provision(BUSINESS, 'suc-1')).resolves.toMatchObject({ ok: true });
    });

    it('uses the store saved by an earlier attempt that lost its POS, read after taking the claim', async () => {
      const { useCase, gateway, repo } = setup();
      const claim = repo.claimSucursalProvisioning.bind(repo);
      jest.spyOn(repo, 'claimSucursalProvisioning').mockImplementationOnce(async (...args) => {
        await repo.saveSucursalStore(BUSINESS, 'suc-1', 'store-earlier');
        return claim(...args);
      });

      await useCase.provision(BUSINESS, 'suc-1');

      expect(gateway.createStore).not.toHaveBeenCalled();
      expect(gateway.createPos).toHaveBeenCalledWith('APP_USR-access-1', expect.objectContaining({ storeId: 'store-earlier' }));
    });
  });

  it('asks to connect the account first when the business is not connected', async () => {
    const { useCase, gateway } = setup({ connected: false });
    const result = await useCase.provision(BUSINESS, 'suc-1');
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe('Conectá tu cuenta de Mercado Pago');
    expect(gateway.createStore).not.toHaveBeenCalled();
  });
});
