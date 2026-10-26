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
