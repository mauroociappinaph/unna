import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PosPage from '@/app/dashboard/pos/page';
import { api } from '@/lib/api';
import { formatMoney, type Order, type PaymentResult, type Product } from '@/lib/api-types';
import shapes from '../fixtures/api-shapes.json';

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
    removeOrderItem: jest.fn(),
    applyOrderDiscount: jest.fn(),
    changeOrderStatus: jest.fn(),
    registerPayment: jest.fn(),
    issueReceipt: jest.fn(),
  },
}));

const mocked = api as jest.Mocked<typeof api>;

const business = {
  id: 'biz-1',
  businessName: 'Resto',
  sucursales: [
    { id: 'suc-2', name: 'Palermo', isMain: false, isActive: true },
    { id: 'suc-1', name: 'Central', isMain: true, isActive: true },
  ],
};

const categories = shapes['GET categories'].body;
const modifierGroups = shapes['GET modifier-groups'].body;
const milanesa = shapes['GET products'].body[0] as Product;
const agua: Product = {
  ...milanesa,
  id: 'prod-agua',
  name: 'Agua',
  basePrice: { amount: 50000, currency: 'ARS' },
  modifierGroupIds: [],
};
const createdOrder = shapes['POST orders'].body as Order;
const guarnicion = modifierGroups[0];
const papas = guarnicion.options[0];

// Testing Library collapses the non-breaking space formatMoney emits.
const shown = (cents: number) => formatMoney(cents).replace(/\s/g, ' ');
const money = (amount: number) => ({ amount, currency: 'ARS' });
const orderWith = (overrides: Partial<Order>): Order => ({ ...createdOrder, ...overrides });
const withAgua = orderWith({
  items: [
    ...createdOrder.items,
    {
      ...createdOrder.items[0],
      id: 'item-agua',
      productId: agua.id,
      productName: 'Agua',
      quantity: 1,
      unitPrice: money(50000),
      totalPrice: money(50000),
      modifiers: [],
    },
  ],
  subtotal: money(390000),
  taxAmount: money(81900),
  totalAmount: money(471900),
});

const apiError = (message: string | string[]) => ({ response: { status: 400, data: { message } } });

const totalsRegion = () => screen.getByRole('region', { name: 'Totales' });
const productButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

async function renderPos() {
  const user = userEvent.setup();
  render(<PosPage />);
  await screen.findByRole('button', { name: /^Agua/ });
  return user;
}

async function addAgua(user: ReturnType<typeof userEvent.setup>) {
  await user.click(productButton('Agua'));
  await screen.findByRole('button', { name: 'Quitar Milanesa' });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('auth_token', 'token');
  mocked.getBusinesses.mockResolvedValue([business]);
  mocked.listCategories.mockResolvedValue(categories as never);
  mocked.listProducts.mockResolvedValue([milanesa, agua]);
  mocked.listModifierGroups.mockResolvedValue(modifierGroups as never);
  mocked.listOrders.mockResolvedValue([]);
  mocked.listPayments.mockResolvedValue([]);
  mocked.createOrder.mockResolvedValue(createdOrder);
  mocked.addOrderItem.mockResolvedValue(withAgua);
});

describe('POS page', () => {
  it('redirects to login without a token', async () => {
    localStorage.removeItem('auth_token');
    render(<PosPage />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
  });

  it('preselects the main sucursal and lists active products by category', async () => {
    await renderPos();

    expect((screen.getByLabelText('Sucursal') as HTMLSelectElement).value).toBe('suc-1');
    expect(mocked.listProducts).toHaveBeenCalledWith('biz-1', { status: 'active' });
    expect(screen.getByRole('heading', { name: 'Platos' })).toBeInTheDocument();
  });

  it('filters products by search', async () => {
    const user = await renderPos();

    await user.type(screen.getByLabelText('Buscar producto'), 'agu');

    expect(productButton('Agua')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Milanesa/ })).not.toBeInTheDocument();
  });

  it('creates the order with the first product and adds the next ones to it', async () => {
    const user = await renderPos();
    await user.selectOptions(screen.getByLabelText('Tipo de pedido'), 'dine_in');
    await user.type(screen.getByLabelText('Mesa'), '4');

    await addAgua(user);
    expect(mocked.createOrder).toHaveBeenCalledWith('biz-1', {
      sucursalId: 'suc-1',
      type: 'dine_in',
      tableNumber: '4',
      items: [{ productId: 'prod-agua', quantity: 1 }],
    });

    await user.click(productButton('Agua'));
    await waitFor(() =>
      expect(mocked.addOrderItem).toHaveBeenCalledWith('biz-1', createdOrder.id, { productId: 'prod-agua', quantity: 1 }),
    );
    expect(mocked.createOrder).toHaveBeenCalledTimes(1);
  });

  it('sends no table number for takeaway orders', async () => {
    const user = await renderPos();
    await user.selectOptions(screen.getByLabelText('Tipo de pedido'), 'takeaway');

    await addAgua(user);

    expect(mocked.createOrder).toHaveBeenCalledWith('biz-1', {
      sucursalId: 'suc-1',
      type: 'takeaway',
      items: [{ productId: 'prod-agua', quantity: 1 }],
    });
  });

  it('blocks the modifier dialog until the required group is satisfied and sends the selection', async () => {
    const user = await renderPos();

    await user.click(productButton('Milanesa'));
    const dialog = await screen.findByRole('dialog', { name: 'Milanesa' });
    const confirm = within(dialog).getByRole('button', { name: 'Agregar al pedido' });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(mocked.createOrder).not.toHaveBeenCalled();

    await user.click(within(dialog).getByLabelText(/Papas/));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() =>
      expect(mocked.createOrder).toHaveBeenCalledWith('biz-1', expect.objectContaining({
        items: [{ productId: milanesa.id, quantity: 1, modifiers: [{ modifierGroupId: guarnicion.id, optionId: papas.id }] }],
      })),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders lines and totals from the server response', async () => {
    const user = await renderPos();

    await addAgua(user);

    const totals = totalsRegion();
    expect(within(totals).getByText(shown(340000))).toBeInTheDocument();
    expect(within(totals).getByText(shown(71400))).toBeInTheDocument();
    expect(within(totals).getByText(shown(411400))).toBeInTheDocument();
    expect(screen.getByText('Papas')).toBeInTheDocument();

    await user.click(productButton('Agua'));
    expect(await within(totalsRegion()).findByText(shown(471900))).toBeInTheDocument();
  });

  it('removes a line through the API', async () => {
    mocked.removeOrderItem.mockResolvedValue(orderWith({ items: [], subtotal: money(0), taxAmount: money(0), totalAmount: money(0) }));
    const user = await renderPos();
    await addAgua(user);

    await user.click(screen.getByRole('button', { name: 'Quitar Milanesa' }));

    await waitFor(() => expect(mocked.removeOrderItem).toHaveBeenCalledWith('biz-1', createdOrder.id, createdOrder.items[0].id));
    expect(await screen.findByText('Agregá productos para armar el pedido.')).toBeInTheDocument();
  });

  it('applies a discount typed in pesos as cents', async () => {
    mocked.applyOrderDiscount.mockResolvedValue(shapes['POST orders/:id/discount'].body as Order);
    const user = await renderPos();
    await addAgua(user);

    await user.type(screen.getByLabelText('Descuento ($)'), '10');
    await user.click(screen.getByRole('button', { name: 'Aplicar descuento' }));

    await waitFor(() => expect(mocked.applyOrderDiscount).toHaveBeenCalledWith('biz-1', createdOrder.id, 1000));
    expect(await within(totalsRegion()).findByText(shown(410400))).toBeInTheDocument();
  });

  it('shows the API error message', async () => {
    mocked.addOrderItem.mockRejectedValue(apiError('El pedido tiene pagos registrados'));
    const user = await renderPos();
    await addAgua(user);

    await user.click(productButton('Agua'));

    expect(await screen.findByText('El pedido tiene pagos registrados')).toBeInTheDocument();
  });

  it('shows every message of an API validation error', async () => {
    mocked.createOrder.mockRejectedValue(apiError(['tableNumber must be a string', 'type is invalid']));
    const user = await renderPos();

    await user.click(productButton('Agua'));

    expect(await screen.findByText('tableNumber must be a string. type is invalid')).toBeInTheDocument();
  });

  describe('payments', () => {
    const discounted = shapes['POST orders/:id/discount'].body as Order;
    const partial = shapes['POST orders/:id/payments (partial)'].body as PaymentResult;
    const rest = shapes['POST orders/:id/payments (rest)'].body as PaymentResult;

    beforeEach(() => {
      mocked.createOrder.mockResolvedValue(discounted);
      mocked.registerPayment.mockResolvedValueOnce(partial).mockResolvedValueOnce(rest);
      mocked.issueReceipt.mockResolvedValue(shapes['POST receipts'].body as never);
    });

    it('splits payments, updates the remaining balance and issues the ticket at 0', async () => {
      const user = await renderPos();
      await addAgua(user);

      await user.click(screen.getByRole('button', { name: 'Cobrar' }));
      const amount = screen.getByLabelText('Monto ($)') as HTMLInputElement;
      expect(amount.value).toBe('4104');
      expect(screen.queryByRole('button', { name: 'Emitir ticket' })).not.toBeInTheDocument();

      await user.clear(amount);
      await user.type(amount, '1000');
      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
      await waitFor(() =>
        expect(mocked.registerPayment).toHaveBeenCalledWith('biz-1', discounted.id, { amount: 100000, method: 'cash' }),
      );
      const payments = screen.getByRole('region', { name: 'Pagos' });
      expect(await within(payments).findByText(shown(310400))).toBeInTheDocument();
      expect(within(payments).getByText(/Efectivo/)).toBeInTheDocument();
      expect((screen.getByLabelText('Monto ($)') as HTMLInputElement).value).toBe('3104');

      await user.selectOptions(screen.getByLabelText('Medio de pago'), 'card');
      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
      await waitFor(() =>
        expect(mocked.registerPayment).toHaveBeenLastCalledWith('biz-1', discounted.id, { amount: 310400, method: 'card' }),
      );

      await user.click(await screen.findByRole('button', { name: 'Emitir ticket' }));
      await waitFor(() => expect(mocked.issueReceipt).toHaveBeenCalledWith('biz-1', discounted.id, { type: 'ticket' }));
      const receipt = await screen.findByRole('region', { name: 'Comprobante' });
      expect(within(receipt).getByText(/ticket-0003-261043205073/)).toBeInTheDocument();
      expect(within(receipt).getByText(/Punto de venta: 0003/)).toBeInTheDocument();
      expect(within(receipt).getByText(/Milanesa/)).toBeInTheDocument();
      expect(within(receipt).getAllByText(shown(410400)).length).toBeGreaterThan(0);
    });

    it('disables editing controls after the first payment', async () => {
      const user = await renderPos();
      await addAgua(user);
      expect(productButton('Agua')).toBeEnabled();

      await user.click(screen.getByRole('button', { name: 'Cobrar' }));
      await user.clear(screen.getByLabelText('Monto ($)'));
      await user.type(screen.getByLabelText('Monto ($)'), '1000');
      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));

      await waitFor(() => expect(productButton('Agua')).toBeDisabled());
      expect(productButton('Milanesa')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Quitar Milanesa' })).toBeDisabled();
      expect(screen.getByLabelText('Descuento ($)')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Aplicar descuento' })).toBeDisabled();
    });
  });

  describe('order status and open orders', () => {
    const openOrder = orderWith({ id: 'order-open', orderNumber: '261025-00001', createdAt: new Date().toISOString() });

    it('resumes an open order of today', async () => {
      const closed = orderWith({ id: 'order-closed', orderNumber: '261025-00002', status: 'delivered', createdAt: new Date().toISOString() });
      const old = orderWith({ id: 'order-old', orderNumber: '200101-00003', createdAt: '2020-01-01T12:00:00.000Z' });
      mocked.listOrders.mockResolvedValue([openOrder, closed, old]);
      mocked.getOrder.mockResolvedValue(openOrder);
      const user = await renderPos();

      await user.click(screen.getByRole('button', { name: 'Pedidos abiertos' }));
      const list = await screen.findByRole('region', { name: 'Pedidos abiertos' });
      expect(within(list).queryByText(/261025-00002/)).not.toBeInTheDocument();
      expect(within(list).queryByText(/200101-00003/)).not.toBeInTheDocument();
      await user.click(within(list).getByRole('button', { name: /261025-00001/ }));

      await waitFor(() => expect(mocked.getOrder).toHaveBeenCalledWith('biz-1', 'order-open'));
      expect(mocked.listPayments).toHaveBeenCalledWith('biz-1', 'order-open');
      expect(await screen.findByText(/Pedido 261025-00001/)).toBeInTheDocument();
      expect(within(totalsRegion()).getByText(shown(411400))).toBeInTheDocument();
    });

    it('changes the status of the order', async () => {
      mocked.changeOrderStatus.mockResolvedValue(orderWith({ status: 'confirmed' }));
      const user = await renderPos();
      await addAgua(user);

      await user.click(screen.getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(mocked.changeOrderStatus).toHaveBeenCalledWith('biz-1', createdOrder.id, 'confirm', undefined));
      expect(await screen.findByRole('button', { name: 'Preparar' })).toBeInTheDocument();
      expect(screen.getByText('Confirmado')).toBeInTheDocument();
    });

    it('requires a reason to cancel and shows the API rejection', async () => {
      mocked.changeOrderStatus.mockRejectedValue(apiError('No se puede cancelar un pedido con pagos'));
      const user = await renderPos();
      await addAgua(user);

      await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
      const confirmCancel = screen.getByRole('button', { name: 'Confirmar cancelación' });
      expect(confirmCancel).toBeDisabled();
      await user.type(screen.getByLabelText('Motivo de cancelación'), 'Cliente se fue');
      await user.click(confirmCancel);

      await waitFor(() =>
        expect(mocked.changeOrderStatus).toHaveBeenCalledWith('biz-1', createdOrder.id, 'cancel', 'Cliente se fue'),
      );
      expect(await screen.findByText('No se puede cancelar un pedido con pagos')).toBeInTheDocument();
    });

    it('starts a new order from scratch', async () => {
      const user = await renderPos();
      await addAgua(user);

      await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }));

      expect(screen.getByText('Agregá productos para armar el pedido.')).toBeInTheDocument();
      await user.click(productButton('Agua'));
      await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(2));
      expect(mocked.addOrderItem).not.toHaveBeenCalled();
    });
  });
});
