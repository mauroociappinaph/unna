import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PedidoAnticipadoPage from '@/app/dashboard/pedido-anticipado/page';
import DashboardPage from '@/app/dashboard/page';
import { api } from '@/lib/api';
import type { PedidoAnticipadoStatus } from '@/lib/api-types';
import { TextEncoder } from 'util';

// qrcode encodes with TextEncoder, which browsers have and jsdom does not.
Object.assign(global, { TextEncoder });

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/lib/api', () => ({
  api: {
    getBusinesses: jest.fn(),
    getPedidoAnticipado: jest.fn(),
    enablePedidoAnticipado: jest.fn(),
    disablePedidoAnticipado: jest.fn(),
  },
}));

const mocked = api as jest.Mocked<typeof api>;

const CENTRAL_URL = 'https://unna.test/pedido/CeNtRaLsLuG0123456';
const PALERMO_URL = 'https://unna.test/pedido/PaLeRmOsLuG0123456';
const status: PedidoAnticipadoStatus = {
  sucursales: [
    { sucursalId: 'suc-1', name: 'Central', enabled: false, url: null },
    { sucursalId: 'suc-2', name: 'Palermo', enabled: true, url: PALERMO_URL },
  ],
};

const apiError = (message: string) => ({ response: { status: 400, data: { message } } });
const card = (name: string) => screen.getByRole('region', { name });
const qr = (name: string) => within(card(name)).queryByRole('img', { name: `QR del pedido anticipado de ${name}` });

let confirmSpy: jest.SpyInstance;

async function renderPage() {
  const user = userEvent.setup();
  render(<PedidoAnticipadoPage />);
  await screen.findByRole('region', { name: 'Central' });
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('auth_token', 'token');
  mocked.getBusinesses.mockResolvedValue([{ id: 'biz-1', businessName: 'Café Lunes', sucursales: [] }]);
  mocked.getPedidoAnticipado.mockResolvedValue(status);
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  confirmSpy.mockRestore();
});

describe('Pedido anticipado panel', () => {
  it('redirects to login without a token', async () => {
    localStorage.removeItem('auth_token');
    render(<PedidoAnticipadoPage />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
    expect(mocked.getPedidoAnticipado).not.toHaveBeenCalled();
  });

  it('shows each sucursal with its state, and the link and QR only when enabled', async () => {
    await renderPage();

    expect(mocked.getPedidoAnticipado).toHaveBeenCalledWith('biz-1');
    expect(within(card('Central')).getByRole('button', { name: 'Activar pedido anticipado' })).toBeInTheDocument();
    expect(within(card('Central')).queryByText(/\/pedido\//)).not.toBeInTheDocument();
    expect(qr('Central')).not.toBeInTheDocument();

    expect(within(card('Palermo')).getByText(PALERMO_URL)).toBeInTheDocument();
    expect(await within(card('Palermo')).findByRole('img', { name: 'QR del pedido anticipado de Palermo' })).toBeInTheDocument();
    expect(within(card('Palermo')).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
  });

  it('enables a sucursal and shows its link and printable QR', async () => {
    mocked.enablePedidoAnticipado.mockResolvedValue({ sucursalId: 'suc-1', enabled: true, slug: 'CeNtRaLsLuG0123456', url: CENTRAL_URL });
    const user = await renderPage();

    await user.click(within(card('Central')).getByRole('button', { name: 'Activar pedido anticipado' }));

    expect(mocked.enablePedidoAnticipado).toHaveBeenCalledWith('biz-1', 'suc-1');
    expect(await within(card('Central')).findByText(CENTRAL_URL)).toBeInTheDocument();
    expect(await within(card('Central')).findByRole('img', { name: 'QR del pedido anticipado de Central' })).toBeInTheDocument();
    expect(within(card('Central')).getByRole('button', { name: 'Imprimir QR' })).toBeInTheDocument();
  });

  it('disables a sucursal after confirmation and hides its link and QR', async () => {
    mocked.disablePedidoAnticipado.mockResolvedValue(undefined);
    const user = await renderPage();
    await within(card('Palermo')).findByRole('img', { name: 'QR del pedido anticipado de Palermo' });

    await user.click(within(card('Palermo')).getByRole('button', { name: 'Desactivar' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mocked.disablePedidoAnticipado).toHaveBeenCalledWith('biz-1', 'suc-2');
    await waitFor(() => expect(within(card('Palermo')).queryByText(PALERMO_URL)).not.toBeInTheDocument());
    expect(qr('Palermo')).not.toBeInTheDocument();
    expect(within(card('Palermo')).getByRole('button', { name: 'Activar pedido anticipado' })).toBeInTheDocument();
  });

  it('keeps the sucursal enabled when the confirmation is cancelled', async () => {
    confirmSpy.mockReturnValue(false);
    const user = await renderPage();

    await user.click(within(card('Palermo')).getByRole('button', { name: 'Desactivar' }));

    expect(mocked.disablePedidoAnticipado).not.toHaveBeenCalled();
    expect(within(card('Palermo')).getByText(PALERMO_URL)).toBeInTheDocument();
  });

  it('copies the link', async () => {
    const user = await renderPage();
    const writeText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    await user.click(within(card('Palermo')).getByRole('button', { name: 'Copiar link' }));

    expect(writeText).toHaveBeenCalledWith(PALERMO_URL);
    expect(await within(card('Palermo')).findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('prints the QR', async () => {
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const user = await renderPage();

    await user.click(within(card('Palermo')).getByRole('button', { name: 'Imprimir QR' }));

    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('shows the API error when enabling fails', async () => {
    mocked.enablePedidoAnticipado.mockRejectedValue(apiError('Sucursal no encontrada'));
    const user = await renderPage();

    await user.click(within(card('Central')).getByRole('button', { name: 'Activar pedido anticipado' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sucursal no encontrada');
    expect(qr('Central')).not.toBeInTheDocument();
  });
});

describe('Dashboard home', () => {
  it('links to the pedido anticipado panel', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('link', { name: /Pedido anticipado/ })).toHaveAttribute('href', '/dashboard/pedido-anticipado');
  });
});
