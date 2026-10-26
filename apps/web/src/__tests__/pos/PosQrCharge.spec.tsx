import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PosPage from '@/app/dashboard/pos/page';
import { api } from '@/lib/api';
import { formatMoney, type CashSession, type Order, type Payment, type Product, type QrCharge } from '@/lib/api-types';
import { TextEncoder } from 'util';
import shapes from '../fixtures/api-shapes.json';

// qrcode encodes with TextEncoder, which browsers have and jsdom does not.
Object.assign(global, { TextEncoder });

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/lib/api', () => ({
  api: {
    getBusinesses: jest.fn(),
    listCategories: jest.fn(),
    listProducts: jest.fn(),
    listModifierGroups: jest.fn(),
    listOrders: jest.fn(),
    getOrder: jest.fn(),
    listPayments: jest.fn(),
    createOrder: jest.fn(),
    addOrderItem: jest.fn(),
    registerPayment: jest.fn(),
    getCurrentCashSession: jest.fn(),
    getTopSellers: jest.fn(),
    createQrCharge: jest.fn(),
    getQrCharge: jest.fn(),
    cancelQrCharge: jest.fn(),
    simulateQrPayment: jest.fn(),
  },
}));

const mocked = api as jest.Mocked<typeof api>;

const business = {
  id: 'biz-1',
  businessName: 'Resto',
  sucursales: [{ id: 'suc-1', name: 'Central', isMain: true, isActive: true }],
};
const milanesa = shapes['GET products'].body[0] as Product;
const agua: Product = { ...milanesa, id: 'prod-agua', name: 'Agua', basePrice: { amount: 50000, currency: 'ARS' }, modifierGroupIds: [] };
const order = shapes['POST orders'].body as Order;
const openSession = shapes['GET cash-sessions/current'].body.session as CashSession;
const total = order.totalAmount.amount;

// Testing Library collapses the non-breaking space formatMoney emits.
const shown = (cents: number) => formatMoney(cents).replace(/\s/g, ' ');
const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

const NOW = new Date('2026-10-25T15:00:00.000Z');
const pending: QrCharge = {
  id: 'qr-1',
  orderId: order.id,
  amount: total,
  status: 'pending',
  qrData: '00020101021243650016COM.MERCADOLIBRE02013063638f1192a-5fd1-4180-a180-8bcae3556bc35204000053039865802AR5925UNNA6009CABA62070503***6304B1C2',
  expiresAt: '2026-10-25T15:15:00.000Z',
  paidAt: null,
};
const qrPayment: Payment = {
  id: 'pay-qr',
  orderId: order.id,
  businessId: 'biz-1',
  amount: total,
  method: 'mercado_pago',
  status: 'completed',
  reference: 'ORD01',
  createdAt: NOW.toISOString(),
};

const advance = async (ms: number) => {
  await act(async () => { jest.advanceTimersByTime(ms); });
};

async function openCheckout() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const view = render(<PosPage />);
  await screen.findAllByRole('button', { name: /^Agua/ });
  await user.click(screen.getAllByRole('button', { name: /^Agua/ })[0]);
  await screen.findByRole('button', { name: 'Quitar Milanesa' });
  await user.click(screen.getByRole('button', { name: 'Cobrar' }));
  return { user, ...view };
}

async function startQr() {
  const view = await openCheckout();
  await view.user.click(screen.getByRole('button', { name: 'Cobrar con QR' }));
  await screen.findByRole('img', { name: 'QR de Mercado Pago para pagar el pedido' });
  return view;
}

const qrRegion = () => screen.getByRole('region', { name: 'Cobro con QR' });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  localStorage.setItem('auth_token', 'token');
  mocked.getBusinesses.mockResolvedValue([business]);
  mocked.listCategories.mockResolvedValue(shapes['GET categories'].body as never);
  mocked.listProducts.mockResolvedValue([agua]);
  mocked.listModifierGroups.mockResolvedValue([]);
  mocked.listOrders.mockResolvedValue([]);
  mocked.listPayments.mockResolvedValue([]);
  mocked.createOrder.mockResolvedValue(order);
  mocked.getCurrentCashSession.mockResolvedValue(openSession);
  mocked.getTopSellers.mockResolvedValue([]);
  mocked.createQrCharge.mockResolvedValue(pending);
  mocked.getQrCharge.mockResolvedValue(pending);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('POS QR charge', () => {
  it('shows the QR, the amount, the countdown and the printed QR reminder', async () => {
    await startQr();

    expect(mocked.createQrCharge).toHaveBeenCalledWith('biz-1', order.id);
    const region = qrRegion();
    const image = within(region).getByRole('img', { name: 'QR de Mercado Pago para pagar el pedido' });
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(within(region).getByText(shown(total))).toBeInTheDocument();
    expect(within(region).getByText('Vence en 15:00')).toBeInTheDocument();
    expect(within(region).getByText(/también puede escanear el QR impreso de la caja/)).toBeInTheDocument();

    await advance(1000);
    expect(within(region).getByText('Vence en 14:59')).toBeInTheDocument();
  });

  it('polls every 3 seconds until paid, shows "Pago recibido", refreshes the payments and stops polling', async () => {
    await startQr();
    expect(mocked.getQrCharge).not.toHaveBeenCalled();

    await advance(3000);
    expect(mocked.getQrCharge).toHaveBeenCalledTimes(1);
    expect(mocked.getQrCharge).toHaveBeenCalledWith('biz-1', 'qr-1');

    mocked.getQrCharge.mockResolvedValue({ ...pending, status: 'paid', paidAt: NOW.toISOString() });
    mocked.getOrder.mockResolvedValue(order);
    mocked.listPayments.mockResolvedValue([qrPayment]);
    await advance(3000);

    expect(await within(qrRegion()).findByText('Pago recibido')).toBeInTheDocument();
    await waitFor(() => expect(mocked.listPayments).toHaveBeenCalledWith('biz-1', order.id));
    expect(mocked.getOrder).toHaveBeenCalledWith('biz-1', order.id);
    const payments = screen.getByRole('region', { name: 'Pagos' });
    expect(await within(payments).findByText('Mercado Pago')).toBeInTheDocument();
    expect(within(payments).getByText(shown(0))).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'QR de Mercado Pago para pagar el pedido' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Emitir ticket' })).toBeInTheDocument();

    await advance(15000);
    expect(mocked.getQrCharge).toHaveBeenCalledTimes(2);
  });

  it('stops polling when the POS unmounts', async () => {
    const { unmount } = await startQr();
    await advance(3000);
    expect(mocked.getQrCharge).toHaveBeenCalledTimes(1);

    unmount();
    await advance(15000);
    expect(mocked.getQrCharge).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending charge with DELETE and stops polling', async () => {
    mocked.cancelQrCharge.mockResolvedValue({ ...pending, status: 'cancelled' });
    const { user } = await startQr();

    await user.click(within(qrRegion()).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(mocked.cancelQrCharge).toHaveBeenCalledWith('biz-1', 'qr-1'));
    expect(await screen.findByRole('button', { name: 'Cobrar con QR' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'QR de Mercado Pago para pagar el pedido' })).not.toBeInTheDocument();
    await advance(9000);
    expect(mocked.getQrCharge).not.toHaveBeenCalled();
  });

  it('offers a new QR once the charge expired', async () => {
    const { user } = await startQr();
    mocked.getQrCharge.mockResolvedValue({ ...pending, status: 'expired' });
    await advance(3000);

    const region = qrRegion();
    expect(await within(region).findByText('El QR venció')).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'QR de Mercado Pago para pagar el pedido' })).not.toBeInTheDocument();

    mocked.createQrCharge.mockResolvedValue({ ...pending, id: 'qr-2', expiresAt: '2026-10-25T15:20:00.000Z' });
    await user.click(within(region).getByRole('button', { name: 'Generar otro QR' }));

    expect(await screen.findByRole('img', { name: 'QR de Mercado Pago para pagar el pedido' })).toBeInTheDocument();
    expect(mocked.createQrCharge).toHaveBeenCalledTimes(2);
    await advance(3000);
    expect(mocked.getQrCharge).toHaveBeenLastCalledWith('biz-1', 'qr-2');
  });

  it('links to the Mercado Pago settings when the account is not connected', async () => {
    mocked.createQrCharge.mockRejectedValue(apiError('Conectá tu cuenta de Mercado Pago'));
    const { user } = await openCheckout();

    await user.click(screen.getByRole('button', { name: 'Cobrar con QR' }));

    const alert = await within(qrRegion()).findByRole('alert');
    expect(alert).toHaveTextContent('Conectá tu cuenta de Mercado Pago');
    expect(within(alert).getByRole('link', { name: 'Ir a Mercado Pago' })).toHaveAttribute('href', '/dashboard/mercadopago');
  });

  it.each(['Activá el cobro QR en esta sucursal', 'Abrí la caja para cobrar'])('shows the backend error "%s"', async (message) => {
    mocked.createQrCharge.mockRejectedValue(apiError(message));
    const { user } = await openCheckout();

    await user.click(screen.getByRole('button', { name: 'Cobrar con QR' }));

    expect(await within(qrRegion()).findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Cobrar con QR' })).toBeEnabled();
    expect(mocked.getQrCharge).not.toHaveBeenCalled();
  });

  it('offers "Simular pago" only while the Mercado Pago simulator is wired, and pays through it', async () => {
    mocked.createQrCharge.mockResolvedValue({ ...pending, simulated: true });
    mocked.simulateQrPayment.mockResolvedValue({ ...pending, status: 'paid', paidAt: NOW.toISOString(), simulated: true });
    mocked.listPayments.mockResolvedValue([]);
    const { user } = await startQr();

    mocked.listPayments.mockResolvedValue([qrPayment]);
    await user.click(within(qrRegion()).getByRole('button', { name: 'Simular pago' }));

    expect(mocked.simulateQrPayment).toHaveBeenCalledWith('biz-1', 'qr-1');
    expect(await within(qrRegion()).findByRole('status')).toHaveTextContent('Pago recibido');
  });

  it('does not offer "Simular pago" with the real Mercado Pago', async () => {
    await startQr();

    expect(within(qrRegion()).queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
  });
});
