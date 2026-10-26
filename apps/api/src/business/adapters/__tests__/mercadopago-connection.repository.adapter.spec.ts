import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaMercadoPagoConnectionRepositoryAdapter } from '../mercadopago-connection.repository.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

const NO_LINKS = { mpStoreId: null, mpPosId: null, mpPosExternalId: null, qrImageUrl: null, qrTemplateUrl: null };
const ATTEMPT = { stateHash: 'h', businessId: 'biz-A', ownerId: 'owner-A', encryptedCodeVerifier: 'v1.x.y.z', expiresAt: new Date('2026-10-25T12:10:00Z') };
const CONNECTION = {
  businessId: 'biz-A', mpUserId: '2', liveMode: true, scope: 's', encryptedAccessToken: 'v1.a', encryptedRefreshToken: 'v1.r',
  accessTokenExpiresAt: new Date('2027-04-23T12:00:00Z'), connectedAt: new Date('2026-10-25T12:00:00Z'),
};

/** Prisma double whose interactive transaction runs the callback against the same client. */
const prismaWith = (models: Record<string, unknown>) => {
  const client: Record<string, unknown> = { ...models };
  client.$transaction = jest.fn(async (work: unknown) => (typeof work === 'function' ? work(client) : Promise.all(work as Promise<unknown>[])));
  return client;
};

describe('PrismaMercadoPagoConnectionRepositoryAdapter (S15)', () => {
  it('consumes an attempt once: only the caller whose delete removed the row gets it', async () => {
    const findUnique = jest.fn(async () => ATTEMPT);
    const deleteMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const adapter = new PrismaMercadoPagoConnectionRepositoryAdapter(fake<PrismaService>(prismaWith({ mercadoPagoOAuthAttempt: { findUnique, deleteMany } })));

    await expect(adapter.consumeOAuthAttempt('h')).resolves.toEqual(ATTEMPT);
    await expect(adapter.consumeOAuthAttempt('h')).resolves.toBeNull();
    expect(deleteMany).toHaveBeenCalledWith({ where: { stateHash: 'h' } });
  });

  it('returns null for an unknown state without deleting anything', async () => {
    const deleteMany = jest.fn();
    const adapter = new PrismaMercadoPagoConnectionRepositoryAdapter(
      fake<PrismaService>(prismaWith({ mercadoPagoOAuthAttempt: { findUnique: jest.fn(async () => null), deleteMany } })),
    );
    await expect(adapter.consumeOAuthAttempt('nope')).resolves.toBeNull();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('scopes sucursal reads and writes to the business', async () => {
    const findFirst = jest.fn(async () => null);
    const updateMany = jest.fn(async () => ({ count: 0 }));
    const adapter = new PrismaMercadoPagoConnectionRepositoryAdapter(fake<PrismaService>(prismaWith({ sucursal: { findFirst, updateMany } })));
    const pos = { mpPosId: 'p', mpPosExternalId: 'e', qrImageUrl: 'q', qrTemplateUrl: 't' };

    await expect(adapter.findSucursal('biz-A', 'suc-B')).resolves.toBeNull();
    await adapter.saveSucursalStore('biz-A', 'suc-B', 'store');
    await adapter.saveSucursalPos('biz-A', 'suc-B', pos);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'suc-B', businessId: 'biz-A' } }));
    expect(updateMany).toHaveBeenNthCalledWith(1, { where: { id: 'suc-B', businessId: 'biz-A' }, data: { mpStoreId: 'store' } });
    expect(updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'suc-B', businessId: 'biz-A' }, data: pos });
  });

  it('clears the sucursal links when the business reconnects with another Mercado Pago account', async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const upsert = jest.fn(async () => ({}));
    const adapter = new PrismaMercadoPagoConnectionRepositoryAdapter(fake<PrismaService>(prismaWith({
      sucursal: { updateMany },
      mercadoPagoConnection: { findUnique: jest.fn(async () => ({ mpUserId: '1' })), upsert },
    })));

    await adapter.saveConnection(CONNECTION);
    expect(updateMany).toHaveBeenCalledWith({ where: { businessId: 'biz-A' }, data: NO_LINKS });
    const { businessId, ...update } = CONNECTION;
    expect(upsert).toHaveBeenCalledWith({ where: { businessId }, create: CONNECTION, update });
  });

  it('disconnects by deleting the connection and clearing every sucursal link of the business together', async () => {
    const deleteMany = jest.fn(async () => ({ count: 1 }));
    const updateMany = jest.fn(async () => ({ count: 2 }));
    const prisma = prismaWith({ mercadoPagoConnection: { deleteMany }, sucursal: { updateMany } });
    await new PrismaMercadoPagoConnectionRepositoryAdapter(fake<PrismaService>(prisma)).deleteConnection('biz-A');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz-A' } });
    expect(updateMany).toHaveBeenCalledWith({ where: { businessId: 'biz-A' }, data: NO_LINKS });
  });

  it('claims the provisioning of a sucursal without POS with one conditional update, taking over stale claims', async () => {
    const updateMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    const adapter = new PrismaMercadoPagoConnectionRepositoryAdapter(fake<PrismaService>(prismaWith({ sucursal: { updateMany } })));
    const now = new Date('2026-10-25T12:00:00Z');
    const staleBefore = new Date('2026-10-25T11:58:00Z');

    await expect(adapter.claimSucursalProvisioning('biz-A', 'suc-1', now, staleBefore)).resolves.toBe(true);
    await expect(adapter.claimSucursalProvisioning('biz-A', 'suc-1', now, staleBefore)).resolves.toBe(false);
    await adapter.releaseSucursalProvisioning('biz-A', 'suc-1');

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'suc-1', businessId: 'biz-A', mpPosId: null, OR: [{ mpProvisioningAt: null }, { mpProvisioningAt: { lt: staleBefore } }] },
      data: { mpProvisioningAt: now },
    });
    expect(updateMany).toHaveBeenNthCalledWith(3, { where: { id: 'suc-1', businessId: 'biz-A' }, data: { mpProvisioningAt: null } });
  });

  it('keeps the sucursal links when the same account reconnects', async () => {
    const updateMany = jest.fn();
    const adapter = new PrismaMercadoPagoConnectionRepositoryAdapter(fake<PrismaService>(prismaWith({
      sucursal: { updateMany },
      mercadoPagoConnection: { findUnique: jest.fn(async () => ({ mpUserId: '2' })), upsert: jest.fn(async () => ({})) },
    })));
    await adapter.saveConnection(CONNECTION);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
