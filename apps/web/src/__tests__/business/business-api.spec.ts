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
