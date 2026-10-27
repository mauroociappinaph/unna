import type { AxiosInstance } from 'axios';
import { createBusinessApi } from '@/lib/api-client/business';

const day = { open: '09:00', close: '18:00', isClosed: false };
const week = { monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: { ...day, isClosed: true } };

describe('business API client: schedules (S21)', () => {
  const patch = jest.fn();
  const businessApi = createBusinessApi({ patch } as unknown as AxiosInstance);

  beforeEach(() => patch.mockReset().mockResolvedValue({ data: { id: 'biz-A' } }));

  it('saves a sucursal schedule on its own route with the week as the body', async () => {
    await businessApi.updateSucursalSchedule('biz-A', 'suc-2', week);

    expect(patch).toHaveBeenCalledWith('/businesses/biz-A/sucursales/suc-2/schedule', week);
  });

  it('saves the business schedule on the business route', async () => {
    await businessApi.updateBusinessSchedule('biz-A', week);

    expect(patch).toHaveBeenCalledWith('/businesses/biz-A/schedule', week);
  });
});

// S21: ManageSucursalDto takes the fields at the top level and rejects unknown ones (forbidNonWhitelisted).
describe('business API client: sucursales (S21)', () => {
  const address = { street: 'Corrientes', number: '1234', floor: '', apartment: '', neighborhood: '', city: 'CABA', province: 'Buenos Aires', postalCode: '1043', country: 'Argentina' };
  const fields = { name: 'Palermo', address, phone: '1145678901', email: 'palermo@unna.test', schedule: week, isMain: false, isActive: true };
  const post = jest.fn();
  const put = jest.fn();
  const businessApi = createBusinessApi({ post, put } as unknown as AxiosInstance);

  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: { id: 'biz-A' } });
    put.mockReset().mockResolvedValue({ data: { id: 'biz-A' } });
  });

  it('creates a sucursal with its fields at the top level of the body', async () => {
    await businessApi.createSucursal('biz-A', fields);

    expect(post).toHaveBeenCalledWith('/businesses/biz-A/sucursales', { action: 'create', ...fields });
  });

  it('updates a sucursal with only the editable fields, even when the form carries the listed sucursal', async () => {
    const listed = { ...fields, id: 'suc-2', address: { ...address, formatted: 'Corrientes 1234, CABA' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

    await businessApi.updateSucursal('biz-A', 'suc-2', listed);

    expect(put).toHaveBeenCalledWith('/businesses/biz-A/sucursales/suc-2', { action: 'update', ...fields });
  });
});
