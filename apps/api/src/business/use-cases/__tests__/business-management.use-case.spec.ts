import { BusinessManagementUseCase } from '../business-management.use-case';
import { Address, Business, BusinessRepositoryPort, NotFoundError, Schedule, Sucursal } from '@unna/domain';
import { fake } from './test-doubles';

const deleteCommand = (sucursalId: string) => ({
  businessId: 'biz-A',
  ownerId: 'owner-A',
  action: 'delete' as const,
  sucursal: { id: sucursalId, name: '', address: { street: '', number: '', city: '', province: '', postalCode: '', country: '' }, phone: '', email: '' },
});

describe('BusinessManagementUseCase.manageSucursal delete', () => {
  let business: { ownerId: string; sucursales: Array<{ id: string }>; removeSucursal: jest.Mock };
  let save: jest.Mock;
  let useCase: BusinessManagementUseCase;

  beforeEach(() => {
    business = { ownerId: 'owner-A', sucursales: [{ id: 'suc-1' }, { id: 'suc-2' }], removeSucursal: jest.fn() };
    save = jest.fn();
    useCase = new BusinessManagementUseCase(
      fake<BusinessRepositoryPort>({
        findById: async () => business as unknown as Business,
        save,
        withBusinessLock: <T>(_id: string, work: (b: Business | null, write: (b: Business) => Promise<void>) => Promise<T>) =>
          work(business as unknown as Business, save),
      }),
    );
  });

  it('rejects an unknown sucursal and saves nothing', async () => {
    const result = await useCase.manageSucursal(deleteCommand('suc-missing'));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe('Sucursal no encontrada');
    expect(business.removeSucursal).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('removes an existing sucursal', async () => {
    const result = await useCase.manageSucursal(deleteCommand('suc-2'));

    expect(result.ok).toBe(true);
    expect(business.removeSucursal).toHaveBeenCalledWith('suc-2');
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('BusinessManagementUseCase edits under the business lock', () => {
  const address = Address.create({ street: 'Corrientes', number: '1234', city: 'CABA', province: 'Buenos Aires', postalCode: '1043', country: 'Argentina' });
  const sucursal = (name: string) => Sucursal.create({ name, address, phone: '1145678901', email: 'suc@unna.test', schedule: Schedule.createClosed(), isMain: false, isActive: true });

  /** A business over the stored sucursales, as each load rebuilds it from the database. */
  const load = (stored: Sucursal[]) => {
    const sucursales = [...stored];
    return {
      ownerId: 'owner-A',
      get sucursales() { return sucursales; },
      addSucursal: (s: Sucursal) => { sucursales.push(s); },
      updateSucursal: (id: string, update: (s: Sucursal) => Sucursal) => {
        const index = sucursales.findIndex((s) => s.id === id);
        if (index !== -1) sucursales[index] = update(sucursales[index]);
      },
    } as unknown as Business;
  };

  /** Stored sucursales behind a row lock: plain reads interleave, locked work runs one after another. */
  const lockedStore = (initial: Sucursal[]) => {
    const state = { stored: initial };
    let queue: Promise<unknown> = Promise.resolve();
    const save = jest.fn(async (b: Business) => { state.stored = [...b.sucursales]; });
    const repository = fake<BusinessRepositoryPort>({
      findById: async () => { const b = load(state.stored); await new Promise((r) => setImmediate(r)); return b; },
      save,
      withBusinessLock: jest.fn(<T>(_id: string, work: (b: Business | null, write: (b: Business) => Promise<void>) => Promise<T>) => {
        const run = queue.then(async () => {
          const b = load(state.stored);
          await new Promise((r) => setImmediate(r));
          return work(b, save);
        });
        queue = run.catch(() => undefined);
        return run;
      }),
    });
    return { state, save, useCase: new BusinessManagementUseCase(repository) };
  };

  it('keeps a sucursal created while another request renames a different one', async () => {
    const centro = sucursal('Centro');
    const { state, useCase } = lockedStore([centro]);
    const fields = { address: { ...address }, phone: '1145678901', email: 'suc@unna.test' };

    const [created, renamed] = await Promise.all([
      useCase.manageSucursal({ businessId: 'biz-A', ownerId: 'owner-A', action: 'create', sucursal: { name: 'Palermo', ...fields } }),
      useCase.manageSucursal({ businessId: 'biz-A', ownerId: 'owner-A', action: 'update', sucursal: { id: centro.id, name: 'Centro Norte', ...fields } }),
    ]);

    expect([created.ok, renamed.ok]).toEqual([true, true]);
    expect(state.stored.map((s) => s.name).sort()).toEqual(['Centro Norte', 'Palermo']);
  });

  it("answers another owner's business as not found and saves nothing", async () => {
    const { save, useCase } = lockedStore([sucursal('Centro')]);

    const result = await useCase.updateSchedule({ businessId: 'biz-A', ownerId: 'owner-B', schedule: Schedule.createClosed().toJSON() });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(NotFoundError);
    expect(!result.ok && result.error.message).toBe('Negocio no encontrado');
    expect(save).not.toHaveBeenCalled();
  });
});
