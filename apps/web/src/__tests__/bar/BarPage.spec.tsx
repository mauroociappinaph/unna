import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BarPage from '@/app/dashboard/barra/page';
import { api } from '@/lib/api';
import shapes from '../fixtures/api-shapes.json';
import { fetchCalls, headerOf, jsonResponse, mockFetch } from './fetch-mock';

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/lib/api', () => ({
  api: {
    getBusinesses: jest.fn(),
    changeOrderStatus: jest.fn(),
  },
}));

const mocked = api as jest.Mocked<typeof api>;

const business = {
  id: 'biz-1',
  businessName: 'Café',
  sucursales: [
    { id: 'suc-2', name: 'Palermo', isMain: false, isActive: true },
    { id: 'suc-1', name: 'Central', isMain: true, isActive: true },
  ],
};

const fullQueue = shapes['GET bar-queue (preparing + ready)'];
const QUEUE_PATH = '/businesses/biz-1/bar-queue';
const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

let fetchMock: jest.Mock;

const queueCalls = () => fetchCalls(fetchMock, QUEUE_PATH);
const column = (name: string) => screen.getByRole('region', { name });
const ticket = (shortNumber: string) => screen.getByRole('article', { name: `Pedido ${shortNumber}` });

async function renderBar() {
  const user = userEvent.setup();
  const view = render(<BarPage />);
  await screen.findByRole('article', { name: 'Pedido 401' });
  return { user, ...view };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('auth_token', 'token');
  mocked.getBusinesses.mockResolvedValue([business]);
  mocked.changeOrderStatus.mockResolvedValue({} as never);
  fetchMock = mockFetch();
  fetchMock.mockImplementation(async () => jsonResponse(fullQueue));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Bar page', () => {
  it('redirects to login without a token', async () => {
    localStorage.removeItem('auth_token');
    render(<BarPage />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the queue of the main sucursal with the owner token', async () => {
    await renderBar();

    expect((screen.getByLabelText('Sucursal') as HTMLSelectElement).value).toBe('suc-1');
    const [[url, init]] = queueCalls();
    expect(url).toMatch(/\/api\/v1\/businesses\/biz-1\/bar-queue\?sucursalId=suc-1$/);
    expect(headerOf(init, 'Authorization')).toBe('Bearer token');
  });

  it('shows the tickets in Nuevos, En preparación and Listos', async () => {
    await renderBar();

    expect(within(column('Nuevos')).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'Pedido 358', 'Pedido 609', 'Pedido 239', 'Pedido 164',
    ]);
    expect(within(column('En preparación')).getAllByRole('article')).toHaveLength(1);
    expect(within(column('Listos')).getAllByRole('article')).toHaveLength(1);

    const preparing = ticket('401');
    expect(within(preparing).getByText('401')).toBeInTheDocument();
    expect(within(preparing).getByText('Martina Pérez')).toBeInTheDocument();
    expect(within(preparing).getByText('Para llevar')).toBeInTheDocument();
    expect(within(preparing).getByText('2× Milanesa')).toBeInTheDocument();
    expect(within(preparing).getByText('Papas')).toBeInTheDocument();
    expect(within(preparing).getByText('Nota: sin azúcar')).toBeInTheDocument();

    expect(within(ticket('358')).getByText('Sin nombre')).toBeInTheDocument();
    expect(within(ticket('358')).getByText('Salón · Mesa 4')).toBeInTheDocument();
    expect(within(ticket('129')).getByText('Juan')).toBeInTheDocument();
  });

  it('starts a pending ticket confirming and then preparing it', async () => {
    const { user } = await renderBar();
    const before = queueCalls().length;

    await user.click(within(ticket('609')).getByRole('button', { name: 'Empezar' }));

    await waitFor(() => expect(mocked.changeOrderStatus).toHaveBeenCalledTimes(2));
    expect(mocked.changeOrderStatus.mock.calls).toEqual([
      ['biz-1', '8e9fc90b-45b2-490f-950b-179e646e0c57', 'confirm'],
      ['biz-1', '8e9fc90b-45b2-490f-950b-179e646e0c57', 'prepare'],
    ]);
    await waitFor(() => expect(queueCalls().length).toBe(before + 1));
  });

  it('starts a confirmed ticket only preparing it', async () => {
    const { user } = await renderBar();

    await user.click(within(ticket('358')).getByRole('button', { name: 'Empezar' }));

    await waitFor(() => expect(mocked.changeOrderStatus).toHaveBeenCalledTimes(1));
    expect(mocked.changeOrderStatus).toHaveBeenCalledWith('biz-1', 'de978796-6e98-42df-b3dc-b15a86b383d2', 'prepare');
  });

  it('moves the ticket before the API answers', async () => {
    let finish: () => void = () => undefined;
    mocked.changeOrderStatus.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({} as never); }));
    const { user } = await renderBar();

    await user.click(within(ticket('358')).getByRole('button', { name: 'Empezar' }));

    expect(within(column('En preparación')).getByRole('article', { name: 'Pedido 358' })).toBeInTheDocument();
    expect(within(column('Nuevos')).queryByRole('article', { name: 'Pedido 358' })).not.toBeInTheDocument();
    await act(async () => finish());
  });

  it('marks a preparing ticket ready and delivers a ready one', async () => {
    const { user } = await renderBar();

    await user.click(within(ticket('401')).getByRole('button', { name: 'Listo' }));
    await waitFor(() => expect(mocked.changeOrderStatus).toHaveBeenCalledWith('biz-1', '4b7ea5c7-92d0-4bcf-86ec-437665d7e2e7', 'ready'));

    await user.click(within(ticket('129')).getByRole('button', { name: 'Entregado' }));
    await waitFor(() => expect(mocked.changeOrderStatus).toHaveBeenCalledWith('biz-1', '51ab139c-0b20-41d0-becc-f7f9d55d49c7', 'deliver'));
    expect(mocked.changeOrderStatus).toHaveBeenCalledTimes(2);
  });

  it('shows the API message and refreshes when an action fails', async () => {
    mocked.changeOrderStatus.mockRejectedValue(apiError('El pedido ya fue entregado'));
    const { user } = await renderBar();
    const before = queueCalls().length;

    await user.click(within(ticket('129')).getByRole('button', { name: 'Entregado' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El pedido ya fue entregado');
    await waitFor(() => expect(queueCalls().length).toBe(before + 1));
    expect(within(column('Listos')).getByRole('article', { name: 'Pedido 129' })).toBeInTheDocument();
  });

  it('loads the queue of another sucursal when it changes', async () => {
    const { user } = await renderBar();

    await user.selectOptions(screen.getByLabelText('Sucursal'), 'suc-2');

    await waitFor(() => expect(queueCalls().at(-1)?.[0]).toMatch(/sucursalId=suc-2$/));
  });

  describe('polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('refreshes every 5 seconds and stops on unmount', async () => {
      const { unmount } = render(<BarPage />);
      await screen.findByRole('article', { name: 'Pedido 401' });
      expect(queueCalls()).toHaveLength(1);

      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(queueCalls()).toHaveLength(2);
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(queueCalls()).toHaveLength(3);

      unmount();
      await act(async () => { jest.advanceTimersByTime(20000); });
      expect(queueCalls()).toHaveLength(3);
    });

    it('waits for the request in flight before polling again', async () => {
      render(<BarPage />);
      await screen.findByRole('article', { name: 'Pedido 401' });
      fetchMock.mockImplementation(() => new Promise(() => undefined));

      await act(async () => { jest.advanceTimersByTime(5000); });
      await act(async () => { jest.advanceTimersByTime(15000); });

      expect(queueCalls()).toHaveLength(2);
    });

    it('updates the queue with the polled data', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(shapes['GET bar-queue (new)']));
      render(<BarPage />);
      await screen.findByRole('article', { name: 'Pedido 401' });
      expect(within(column('Nuevos')).getByRole('article', { name: 'Pedido 401' })).toBeInTheDocument();

      fetchMock.mockImplementation(async () => jsonResponse(fullQueue));
      await act(async () => { jest.advanceTimersByTime(5000); });

      await waitFor(() => expect(within(column('En preparación')).getByRole('article', { name: 'Pedido 401' })).toBeInTheDocument());
    });
  });
});
