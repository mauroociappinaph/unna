import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MercadoPagoPage from '@/app/dashboard/mercadopago/page';
import DashboardPage from '@/app/dashboard/page';
import { api } from '@/lib/api';
import { redirectTo } from '@/lib/navigation';
import type { MercadoPagoStatus } from '@/lib/api-types';

const router = { push: jest.fn() };
let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => searchParams }));
jest.mock('@/lib/navigation', () => ({ redirectTo: jest.fn() }));
jest.mock('@/lib/api', () => ({
  api: {
    getBusinesses: jest.fn(),
    getMercadoPagoStatus: jest.fn(),
    connectMercadoPago: jest.fn(),
    disconnectMercadoPago: jest.fn(),
    provisionMercadoPagoPos: jest.fn(),
  },
}));

const mocked = api as jest.Mocked<typeof api>;

const business = { id: 'biz-1', businessName: 'Resto', sucursales: [] };
const disconnected: MercadoPagoStatus = { connected: false, mpUserId: null, liveMode: null, connectedAt: null, sucursales: [] };
const connected: MercadoPagoStatus = {
  connected: true,
  mpUserId: '123456',
  liveMode: true,
  connectedAt: '2026-10-25T12:00:00.000Z',
  sucursales: [
    { sucursalId: 'suc-1', name: 'Central', ready: false, qrImageUrl: null, qrTemplateUrl: null },
    { sucursalId: 'suc-2', name: 'Palermo', ready: true, qrImageUrl: 'https://mp.test/palermo.png', qrTemplateUrl: 'https://mp.test/palermo.pdf' },
  ],
};

const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

async function renderPage(status: MercadoPagoStatus) {
  mocked.getMercadoPagoStatus.mockResolvedValue(status);
  const user = userEvent.setup();
  render(<MercadoPagoPage />);
  await screen.findByRole('heading', { name: 'Mercado Pago' });
  await waitFor(() => expect(mocked.getMercadoPagoStatus).toHaveBeenCalledWith('biz-1'));
  return user;
}

const sucursalCard = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  jest.clearAllMocks();
  searchParams = new URLSearchParams();
  localStorage.setItem('auth_token', 'token');
  mocked.getBusinesses.mockResolvedValue([business]);
});

describe('Mercado Pago page', () => {
  it('redirects to login without a token', async () => {
    localStorage.removeItem('auth_token');
    mocked.getMercadoPagoStatus.mockResolvedValue(disconnected);
    render(<MercadoPagoPage />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
  });

  it('connects by navigating to the Mercado Pago authorization URL', async () => {
    mocked.connectMercadoPago.mockResolvedValue({ authorizationUrl: 'https://auth.mercadopago.com/authorization?state=s1' });
    const user = await renderPage(disconnected);

    await user.click(await screen.findByRole('button', { name: 'Conectar con Mercado Pago' }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://auth.mercadopago.com/authorization?state=s1'));
    expect(mocked.connectMercadoPago).toHaveBeenCalledWith('biz-1');
  });

  it('shows the API error when connecting fails', async () => {
    mocked.connectMercadoPago.mockRejectedValue(apiError('Mercado Pago no está disponible'));
    const user = await renderPage(disconnected);

    await user.click(await screen.findByRole('button', { name: 'Conectar con Mercado Pago' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mercado Pago no está disponible');
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('shows an error when the authorization came back with status=error', async () => {
    searchParams = new URLSearchParams('status=error');
    await renderPage(disconnected);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar tu cuenta de Mercado Pago. Probá de nuevo.');
  });

  it('confirms the connection when it came back with status=connected', async () => {
    searchParams = new URLSearchParams('status=connected');
    await renderPage(connected);

    expect(await screen.findByRole('status')).toHaveTextContent('Tu cuenta de Mercado Pago quedó conectada.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('activates the QR of a sucursal and shows the printed QR', async () => {
    mocked.provisionMercadoPagoPos.mockResolvedValue({
      sucursalId: 'suc-1', ready: true, qrImageUrl: 'https://mp.test/central.png', qrTemplateUrl: 'https://mp.test/central.pdf',
    });
    const user = await renderPage(connected);
    expect(await screen.findByText(/Cuenta conectada/)).toBeInTheDocument();

    const central = sucursalCard('Central');
    expect(within(central).queryByRole('img')).not.toBeInTheDocument();
    await user.click(within(central).getByRole('button', { name: 'Activar cobro QR' }));

    await waitFor(() => expect(mocked.provisionMercadoPagoPos).toHaveBeenCalledWith('biz-1', 'suc-1'));
    expect(await within(central).findByRole('img', { name: 'QR impreso de Central' })).toHaveAttribute('src', 'https://mp.test/central.png');
    expect(within(central).getByRole('link', { name: 'Descargar para imprimir' })).toHaveAttribute('href', 'https://mp.test/central.pdf');
    expect(within(central).queryByRole('button', { name: 'Activar cobro QR' })).not.toBeInTheDocument();
  });

  it('shows the printed QR of a sucursal that is already ready', async () => {
    await renderPage(connected);

    const palermo = await screen.findByRole('region', { name: 'Palermo' });
    expect(within(palermo).getByRole('img', { name: 'QR impreso de Palermo' })).toHaveAttribute('src', 'https://mp.test/palermo.png');
    expect(within(palermo).getByRole('link', { name: 'Descargar para imprimir' })).toHaveAttribute('href', 'https://mp.test/palermo.pdf');
  });

  it('shows the API error when activating the QR fails', async () => {
    mocked.provisionMercadoPagoPos.mockRejectedValue(apiError('Conectá tu cuenta de Mercado Pago'));
    const user = await renderPage(connected);

    await user.click(within(await screen.findByRole('region', { name: 'Central' })).getByRole('button', { name: 'Activar cobro QR' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conectá tu cuenta de Mercado Pago');
  });

  it('disconnects only after confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    mocked.disconnectMercadoPago.mockResolvedValue(undefined);
    const user = await renderPage(connected);

    await user.click(await screen.findByRole('button', { name: 'Desconectar' }));
    expect(mocked.disconnectMercadoPago).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Desconectar' }));
    await waitFor(() => expect(mocked.disconnectMercadoPago).toHaveBeenCalledWith('biz-1'));
    expect(await screen.findByRole('button', { name: 'Conectar con Mercado Pago' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Central' })).not.toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    confirmSpy.mockRestore();
  });
});

describe('Dashboard home', () => {
  it('links to Mercado Pago', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('link', { name: /Mercado Pago/ })).toHaveAttribute('href', '/dashboard/mercadopago');
  });
});
