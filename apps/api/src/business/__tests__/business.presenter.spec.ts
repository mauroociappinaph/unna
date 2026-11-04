import { Address, Business, BusinessName, BusinessRepositoryPort, BusinessSettings, CUIT, Schedule, Sucursal } from '@unna/domain';
import { BusinessManagementUseCase } from '../use-cases/business-management.use-case';
import { toBusinessView } from '../business.presenter';
import { fake } from '../use-cases/__tests__/test-doubles';

const day = { open: '09:00', close: '23:00', isClosed: false };
const week = { monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: { open: '00:00', close: '00:00', isClosed: true } };
const address = { street: 'Av. Corrientes', number: '1234', city: 'CABA', province: 'CABA', postalCode: '1043', country: 'Argentina' };
const when = new Date('2026-10-25T12:00:00.000Z');

const business = (id: string, ownerId: string) =>
  Business.reconstitute(id, {
    name: BusinessName.create('Resto Uno'),
    cuit: CUIT.create('20123456786'),
    address: Address.create(address),
    schedule: Schedule.create(week),
    settings: BusinessSettings.create({ tradeName: 'Resto Uno', ivaCondition: 'responsable_inscripto', salePoint: '0003', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', language: 'es' }),
    ownerId,
    slug: 'resto-uno',
    isActive: true,
    sucursales: [
      Sucursal.reconstitute({ id: 'suc-1', name: 'Central', address: Address.create(address), phone: '1123456789', email: 'central@test.com', schedule: Schedule.create(week), isMain: true, isActive: true, createdAt: when, updatedAt: when }),
    ],
    createdAt: when,
    updatedAt: when,
  });

describe('toBusinessView', () => {
  it('flattens the aggregate into the shape the web consumes', () => {
    const view = toBusinessView(business('biz-A', 'owner-A'));

    expect(view).toEqual({
      id: 'biz-A',
      businessName: 'Resto Uno',
      cuit: '20123456786',
      address: expect.objectContaining(address),
      schedule: week,
      settings: expect.objectContaining({ tradeName: 'Resto Uno', salePoint: '0003', currency: 'ARS' }),
      slug: 'resto-uno',
      isActive: true,
      sucursales: [
        {
          id: 'suc-1', name: 'Central', address: expect.objectContaining(address), phone: '1123456789', email: 'central@test.com',
          schedule: week, isMain: true, isActive: true, createdAt: when.toISOString(), updatedAt: when.toISOString(),
        },
      ],
      createdAt: when.toISOString(),
      updatedAt: when.toISOString(),
    });
    expect(JSON.parse(JSON.stringify(view))).toEqual(JSON.parse(JSON.stringify(view)));
    expect(view).not.toHaveProperty('props');
  });
});

describe('BusinessManagementUseCase queries', () => {
  const repo = fake<BusinessRepositoryPort>({
    findByOwnerId: async (ownerId: string) => (ownerId === 'owner-A' ? [business('biz-A', 'owner-A')] : []),
    findById: async (id: string) => (id === 'biz-A' ? business('biz-A', 'owner-A') : null),
  });
  const useCase = new BusinessManagementUseCase(repo);

  it('lists only the businesses of the owner', async () => {
    const mine = await useCase.listMine('owner-A');
    const others = await useCase.listMine('owner-B');

    expect(mine.map((b) => b.id)).toEqual(['biz-A']);
    expect(others).toEqual([]);
  });

  it('returns a business to its owner', async () => {
    const result = await useCase.getMine('biz-A', 'owner-A');
    expect(result.ok && result.value.id).toBe('biz-A');
  });

  it.each([
    ['another owner', 'biz-A', 'owner-B'],
    ['an unknown id', 'biz-missing', 'owner-A'],
  ])('reports not found for %s', async (_case, id, owner) => {
    const result = await useCase.getMine(id, owner);
    expect(!result.ok && result.error.message).toBe('Negocio no encontrado');
  });
});
