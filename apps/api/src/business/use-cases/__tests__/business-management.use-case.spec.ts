import { BusinessManagementUseCase } from '../business-management.use-case';
import { Business, BusinessRepositoryPort } from '@unna/domain';
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
      fake<BusinessRepositoryPort>({ findById: async () => business as unknown as Business, save }),
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
