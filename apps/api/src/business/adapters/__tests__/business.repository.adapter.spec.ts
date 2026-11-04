import { Business, Schedule } from '@unna/domain';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaBusinessRepositoryAdapter } from '../business.repository.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

describe('PrismaBusinessRepositoryAdapter.findOwnerId (S17)', () => {
  it('selects only id and ownerId and returns the owner', async () => {
    const findUnique = jest.fn(async () => ({ id: 'biz-A', ownerId: 'user-1' }));
    const repository = new PrismaBusinessRepositoryAdapter(fake<PrismaService>({ business: { findUnique } }));

    await expect(repository.findOwnerId('biz-A')).resolves.toBe('user-1');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'biz-A' }, select: { id: true, ownerId: true } });
  });

  it('returns null for an unknown business', async () => {
    const repository = new PrismaBusinessRepositoryAdapter(fake<PrismaService>({ business: { findUnique: async () => null } }));

    await expect(repository.findOwnerId('nope')).resolves.toBeNull();
  });
});

describe('PrismaBusinessRepositoryAdapter.withBusinessLock', () => {
  const business = {
    id: 'biz-A',
    name: { value: 'Café Unna' },
    slug: 'cafe-unna',
    cuit: { value: '20123456786' },
    address: { street: 'Corrientes' },
    schedule: Schedule.createClosed(),
    settings: { tradeName: 'Unna' },
    ownerId: 'owner-A',
    isActive: true,
    sucursales: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Business;

  /** Records, in order, the calls made inside the interactive transaction. */
  const fakePrisma = () => {
    const calls: string[] = [];
    const tx = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        calls.push(strings.reduce((text, part, i) => text + part + (i < values.length ? `<${String(values[i])}>` : ''), ''));
        return [];
      },
      business: {
        findUnique: jest.fn(async () => { calls.push('read business'); return null; }),
        upsert: jest.fn(async () => { calls.push('upsert business'); }),
      },
      sucursal: {
        deleteMany: jest.fn(async () => { calls.push('delete removed sucursales'); }),
        upsert: jest.fn(async () => { calls.push('upsert sucursal'); }),
      },
    };
    const outside = { upsert: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn() };
    const prisma = {
      $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
      business: outside,
      sucursal: outside,
    };
    return { repository: new PrismaBusinessRepositoryAdapter(fake<PrismaService>(prisma)), calls, tx, outside };
  };

  it('locks the business row before reading it and passes null for a missing business', async () => {
    const { repository, calls } = fakePrisma();

    const seen = await repository.withBusinessLock('biz-A', async (locked) => locked);

    expect(seen).toBeNull();
    expect(calls).toEqual(['SELECT id FROM businesses WHERE id = <biz-A> FOR UPDATE', 'read business']);
  });

  it('hands out a save that writes through the transaction', async () => {
    const { repository, calls, tx, outside } = fakePrisma();

    await repository.withBusinessLock('biz-A', async (_locked, save) => save(business));

    expect(calls).toEqual([
      'SELECT id FROM businesses WHERE id = <biz-A> FOR UPDATE',
      'read business',
      'upsert business',
      'delete removed sucursales',
    ]);
    expect(tx.sucursal.deleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz-A', id: { notIn: [] } } });
    expect(outside.upsert).not.toHaveBeenCalled();
    expect(outside.deleteMany).not.toHaveBeenCalled();
  });
});
