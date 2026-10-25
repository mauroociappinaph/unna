import { render, screen } from '@testing-library/react';
import HorariosPage from '@/app/dashboard/horarios/page';
import { api } from '@/lib/api';

// Like Next, the search params object stays the same until the URL changes.
let query = '';
const paramsByQuery = new Map<string, URLSearchParams>();
const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => {
    if (!paramsByQuery.has(query)) paramsByQuery.set(query, new URLSearchParams(query));
    return paramsByQuery.get(query);
  },
}));
jest.mock('@/lib/api', () => ({ api: { getBusinesses: jest.fn() } }));

const week = (open: string) => {
  const day = { open, close: '23:00', isClosed: false };
  return { monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: day };
};

const business = {
  id: 'biz-A',
  businessName: 'Resto',
  schedule: week('08:00'),
  sucursales: [
    { id: 'suc-1', name: 'Central', isMain: true, schedule: week('09:00') },
    { id: 'suc-2', name: 'Palermo', isMain: false, schedule: week('11:30') },
  ],
};

const mondayOpen = async () => (await screen.findAllByDisplayValue(/^\d\d:\d\d$/))[0] as HTMLInputElement;

describe('Horarios page', () => {
  beforeEach(() => {
    localStorage.setItem('auth_token', 'token');
    (api.getBusinesses as jest.Mock).mockResolvedValue([business]);
  });

  it('loads the schedule of the sucursal in the URL', async () => {
    query = 'sucursal=suc-2';
    render(<HorariosPage />);

    expect((await mondayOpen()).value).toBe('11:30');
  });

  it('loads the business schedule by default', async () => {
    query = '';
    render(<HorariosPage />);

    expect((await mondayOpen()).value).toBe('08:00');
  });

  it('shows the newly selected sucursal when the URL changes', async () => {
    query = 'sucursal=suc-1';
    const { rerender } = render(<HorariosPage />);
    expect((await mondayOpen()).value).toBe('09:00');

    query = 'sucursal=suc-2';
    rerender(<HorariosPage />);

    await screen.findAllByDisplayValue('11:30');
    expect((await mondayOpen()).value).toBe('11:30');
  });
});
