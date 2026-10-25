import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PosPage from '@/app/dashboard/pos/page';
import { api } from '@/lib/api';
import { formatMoney, type CashSession, type Order, type PaymentResult, type Product, type Receipt } from '@/lib/api-types';
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
    getCurrentCashSession: jest.fn(),
    getTopSellers: jest.fn(),
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
const openSession = shapes['GET cash-sessions/current'].body.session as CashSession;
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
  // The favorites strip may repeat a product card.
  await screen.findAllByRole('button', { name: /^Agua/ });
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
  mocked.getCurrentCashSession.mockResolvedValue(openSession);
  mocked.getTopSellers.mockResolvedValue([]);
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
    expect(mocked.getCurrentCashSession).toHaveBeenCalledWith('biz-1', 'suc-1');
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

  it('starts in "Para llevar" and returns to it on a new order', async () => {
    const user = await renderPos();
    expect(screen.getByLabelText('Tipo de pedido')).toHaveValue('takeaway');
    expect(screen.queryByLabelText('Mesa')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Tipo de pedido'), 'dine_in');
    await addAgua(user);
    await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }));

    expect(screen.getByLabelText('Tipo de pedido')).toHaveValue('takeaway');
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
      expect(within(receipt).getByText('Ticket N° 0003-00000001')).toBeInTheDocument();
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

  describe('caja', () => {
    it('blocks selling without an open caja and links to it', async () => {
      mocked.getCurrentCashSession.mockResolvedValue(null);
      await renderPos();

      const banner = await screen.findByRole('status', { name: 'Caja cerrada' });
      expect(within(banner).getByText('Abrí la caja para empezar a vender')).toBeInTheDocument();
      expect(within(banner).getByRole('link', { name: 'Ir a la caja' })).toHaveAttribute('href', '/dashboard/caja');
      expect(productButton('Agua')).toBeDisabled();
      expect(productButton('Milanesa')).toBeDisabled();
      expect(mocked.createOrder).not.toHaveBeenCalled();
    });

    it('reloads the caja when the sucursal changes', async () => {
      mocked.getCurrentCashSession.mockImplementation(async (_biz, sucursalId) => (sucursalId === 'suc-1' ? openSession : null));
      const user = await renderPos();
      expect(productButton('Agua')).toBeEnabled();

      await user.selectOptions(screen.getByLabelText('Sucursal'), 'suc-2');

      expect(await screen.findByText('Abrí la caja para empezar a vender')).toBeInTheDocument();
      expect(mocked.getCurrentCashSession).toHaveBeenLastCalledWith('biz-1', 'suc-2');
      expect(productButton('Agua')).toBeDisabled();
    });

    it('still shows the API rejection when the caja was closed meanwhile', async () => {
      mocked.createOrder.mockRejectedValue(apiError(shapes['POST orders without open caja'].body.message));
      const user = await renderPos();

      await user.click(productButton('Agua'));

      expect(await screen.findByRole('alert')).toHaveTextContent('Abrí la caja para empezar a vender');
    });
  });

  describe('fiscal receipts', () => {
    const discounted = shapes['POST orders/:id/discount'].body as Order;
    const rest = shapes['POST orders/:id/payments (rest)'].body as PaymentResult;
    const facturaB = shapes['POST receipts (factura B)'].body as Receipt;
    const facturaA = shapes['POST receipts (factura A)'].body as Receipt;
    const withCondition = (ivaCondition: string) => ({ ...business, settings: { ivaCondition } });

    beforeEach(() => {
      mocked.createOrder.mockResolvedValue(discounted);
      mocked.registerPayment.mockResolvedValue(rest);
    });

    async function payInFull(ivaCondition: string) {
      mocked.getBusinesses.mockResolvedValue([withCondition(ivaCondition)]);
      const user = await renderPos();
      await addAgua(user);
      await user.click(screen.getByRole('button', { name: 'Cobrar' }));
      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
      await screen.findByRole('group', { name: 'Comprobante' });
      return user;
    }

    it('offers factura B by default, factura A and ticket to a responsable inscripto', async () => {
      mocked.issueReceipt.mockResolvedValue(facturaB);
      const user = await payInFull('responsable_inscripto');

      const choice = screen.getByRole('group', { name: 'Comprobante' });
      expect(within(choice).getByLabelText('Factura B')).toBeChecked();
      expect(within(choice).getByLabelText('Factura A')).not.toBeChecked();
      expect(within(choice).getByLabelText('Ticket')).toBeInTheDocument();
      expect(within(choice).queryByLabelText('Factura C')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Emitir factura B' }));

      await waitFor(() => expect(mocked.issueReceipt).toHaveBeenCalledWith('biz-1', discounted.id, { type: 'B' }));
    });

    it('shows CAE, its expiration, IVA lines and the ARCA link of an issued factura', async () => {
      mocked.issueReceipt.mockResolvedValue(facturaB);
      const user = await payInFull('responsable_inscripto');

      await user.click(screen.getByRole('button', { name: 'Emitir factura B' }));

      const receipt = await screen.findByRole('region', { name: 'Comprobante' });
      expect(within(receipt).getByText('Factura B N° 0003-00000001')).toBeInTheDocument();
      expect(within(receipt).getByText('CAE: 70003060000001')).toBeInTheDocument();
      expect(within(receipt).getByText('Vencimiento CAE: 04/11/2026')).toBeInTheDocument();
      expect(within(receipt).getByText('IVA 21%')).toBeInTheDocument();
      expect(within(receipt).getByText(shown(35700))).toBeInTheDocument();
      expect(within(receipt).getByText(shown(205700))).toBeInTheDocument();
      expect(within(receipt).getByRole('link', { name: 'Verificar en ARCA' })).toHaveAttribute('href', facturaB.qrCode);
      expect(screen.queryByRole('group', { name: 'Comprobante' })).not.toBeInTheDocument();
    });

    it('requires CUIT, razón social and condición for factura A and sends the customer data', async () => {
      mocked.issueReceipt.mockResolvedValue(facturaA);
      const user = await payInFull('responsable_inscripto');

      await user.click(screen.getByLabelText('Factura A'));
      await user.click(screen.getByRole('button', { name: 'Emitir factura A' }));
      expect(await screen.findByText('La factura A requiere el CUIT del cliente (11 dígitos).')).toBeInTheDocument();
      expect(mocked.issueReceipt).not.toHaveBeenCalled();

      await user.type(screen.getByLabelText('CUIT del cliente'), '30-71234567-1');
      await user.click(screen.getByRole('button', { name: 'Emitir factura A' }));
      expect(await screen.findByText('Ingresá la razón social del cliente.')).toBeInTheDocument();
      expect(mocked.issueReceipt).not.toHaveBeenCalled();

      await user.type(screen.getByLabelText('Razón social'), 'Cliente SA');
      await user.selectOptions(screen.getByLabelText('Condición frente al IVA'), 'responsable_inscripto');
      await user.click(screen.getByRole('button', { name: 'Emitir factura A' }));

      await waitFor(() =>
        expect(mocked.issueReceipt).toHaveBeenCalledWith('biz-1', discounted.id, {
          type: 'A',
          customerName: 'Cliente SA',
          customerTaxId: '30712345671',
          customerCondition: 'responsable_inscripto',
        }),
      );
      const receipt = await screen.findByRole('region', { name: 'Comprobante' });
      expect(within(receipt).getByText('Factura A N° 0003-00000001')).toBeInTheDocument();
      expect(within(receipt).getByText(/Cliente SA/)).toBeInTheDocument();
      expect(within(receipt).getByText(/30712345671/)).toBeInTheDocument();
    });

    it('offers factura C by default and ticket to a monotributista', async () => {
      mocked.issueReceipt.mockResolvedValue({ ...facturaB, type: 'C', receiptType: 'C', ivaBreakdown: [] });
      const user = await payInFull('monotributo');

      const choice = screen.getByRole('group', { name: 'Comprobante' });
      expect(within(choice).getByLabelText('Factura C')).toBeChecked();
      expect(within(choice).getByLabelText('Ticket')).toBeInTheDocument();
      expect(within(choice).queryByLabelText('Factura B')).not.toBeInTheDocument();
      expect(within(choice).queryByLabelText('Factura A')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Emitir factura C' }));

      await waitFor(() => expect(mocked.issueReceipt).toHaveBeenCalledWith('biz-1', discounted.id, { type: 'C' }));
      const receipt = await screen.findByRole('region', { name: 'Comprobante' });
      expect(within(receipt).getByText('Factura C N° 0003-00000001')).toBeInTheDocument();
      expect(within(receipt).queryByText(/^IVA/)).not.toBeInTheDocument();
    });

    it('issues a ticket when chosen instead of the factura', async () => {
      mocked.issueReceipt.mockResolvedValue(shapes['POST receipts'].body as never);
      const user = await payInFull('monotributo');

      await user.click(screen.getByLabelText('Ticket'));
      await user.click(screen.getByRole('button', { name: 'Emitir ticket' }));

      await waitFor(() => expect(mocked.issueReceipt).toHaveBeenCalledWith('biz-1', discounted.id, { type: 'ticket' }));
      const receipt = await screen.findByRole('region', { name: 'Comprobante' });
      expect(within(receipt).queryByText(/CAE/)).not.toBeInTheDocument();
      expect(within(receipt).queryByRole('link', { name: 'Verificar en ARCA' })).not.toBeInTheDocument();
    });

    it('shows the ARCA rejection message', async () => {
      mocked.issueReceipt.mockRejectedValue(apiError('ARCA rechazó el comprobante: 10016 - Número inválido'));
      const user = await payInFull('responsable_inscripto');

      await user.click(screen.getByRole('button', { name: 'Emitir factura B' }));

      expect(await screen.findByText('ARCA rechazó el comprobante: 10016 - Número inválido')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Comprobante' })).toBeInTheDocument();
    });

    it('offers a retry when ARCA is unavailable and the retry re-issues', async () => {
      mocked.issueReceipt
        .mockRejectedValueOnce({ response: { status: 503, data: { message: 'ARCA no está disponible en este momento' } } })
        .mockResolvedValueOnce(facturaB);
      const user = await payInFull('responsable_inscripto');

      await user.click(screen.getByRole('button', { name: 'Emitir factura B' }));

      expect(await screen.findByText('ARCA no está disponible; el comprobante quedó en borrador')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Reintentar' }));

      await waitFor(() => expect(mocked.issueReceipt).toHaveBeenCalledTimes(2));
      expect(mocked.issueReceipt).toHaveBeenLastCalledWith('biz-1', discounted.id, { type: 'B' });
      expect(await screen.findByText('CAE: 70003060000001')).toBeInTheDocument();
      expect(screen.queryByText('ARCA no está disponible; el comprobante quedó en borrador')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });
  });
  describe('peak hour', () => {
    const product = (id: string, name: string, extra: Partial<Product> = {}): Product => ({
      ...agua, id, name, isFavorite: false, ...extra,
    });
    const strip = () => screen.getByRole('region', { name: 'Favoritos' });
    const stripNames = () => within(strip()).getAllByRole('button').map((b) => b.textContent?.split('$')[0].trim());
    const search = () => screen.getByLabelText('Buscar producto') as HTMLInputElement;

    describe('favorites strip', () => {
      it('shows pinned products first, then top sellers without duplicates, up to 8', async () => {
        const cafe = product('prod-cafe', 'Café', { isFavorite: true });
        const pinnedMilanesa = { ...milanesa, isFavorite: true };
        const extras = [1, 2, 3, 4, 5, 6, 7].map((n) => product(`prod-${n}`, `Medialuna ${n}`));
        mocked.listProducts.mockResolvedValue([pinnedMilanesa, agua, cafe, ...extras]);
        mocked.getTopSellers.mockResolvedValue([
          { productId: agua.id, name: 'Agua', quantity: 9 },
          { productId: milanesa.id, name: 'Milanesa', quantity: 8 },
          { productId: 'prod-archived', name: 'Archivado', quantity: 7 },
          ...extras.map((p, i) => ({ productId: p.id, name: p.name, quantity: 6 - i })),
        ]);
        await renderPos();

        expect(mocked.getTopSellers).toHaveBeenCalledWith('biz-1', { days: 7, limit: 8 });
        expect(stripNames()).toEqual([
          'Café', 'Milanesa', 'Agua', 'Medialuna 1', 'Medialuna 2', 'Medialuna 3', 'Medialuna 4', 'Medialuna 5',
        ]);
      });

      it('adds a favorite with one tap and opens the modifier dialog when required', async () => {
        mocked.getTopSellers.mockResolvedValue([
          { productId: agua.id, name: 'Agua', quantity: 3 },
          { productId: milanesa.id, name: 'Milanesa', quantity: 2 },
        ]);
        const user = await renderPos();

        await user.click(within(strip()).getByRole('button', { name: /^Agua/ }));
        await waitFor(() =>
          expect(mocked.createOrder).toHaveBeenCalledWith('biz-1', {
            sucursalId: 'suc-1',
            type: 'takeaway',
            items: [{ productId: 'prod-agua', quantity: 1 }],
          }),
        );

        await user.click(within(strip()).getByRole('button', { name: /^Milanesa/ }));
        expect(await screen.findByRole('dialog', { name: 'Milanesa' })).toBeInTheDocument();
      });

      it('hides the strip without favorites and still sells when top sellers fail', async () => {
        mocked.getTopSellers.mockRejectedValue(apiError('boom'));
        const user = await renderPos();

        expect(screen.queryByRole('region', { name: 'Favoritos' })).not.toBeInTheDocument();
        await addAgua(user);
      });

      it('disables favorites without an open caja', async () => {
        mocked.getCurrentCashSession.mockResolvedValue(null);
        mocked.getTopSellers.mockResolvedValue([{ productId: agua.id, name: 'Agua', quantity: 3 }]);
        await renderPos();

        expect(within(strip()).getByRole('button', { name: /^Agua/ })).toBeDisabled();
      });
    });

    describe('keyboard', () => {
      it('focuses the search with "/" without typing it', async () => {
        const user = await renderPos();

        await user.keyboard('/');

        expect(search()).toHaveFocus();
        expect(search().value).toBe('');
      });

      it('does not steal "/" while typing in another input', async () => {
        const user = await renderPos();
        await user.selectOptions(screen.getByLabelText('Tipo de pedido'), 'dine_in');
        await user.type(screen.getByLabelText('Mesa'), '4/');

        expect((screen.getByLabelText('Mesa') as HTMLInputElement).value).toBe('4/');
        expect(search()).not.toHaveFocus();
      });

      it('adds the first visible match with Enter', async () => {
        const user = await renderPos();

        await user.keyboard('/');
        await user.keyboard('agu{Enter}');

        await waitFor(() =>
          expect(mocked.createOrder).toHaveBeenCalledWith('biz-1', expect.objectContaining({
            items: [{ productId: 'prod-agua', quantity: 1 }],
          })),
        );
      });

      it('opens the modifier dialog when the first match requires modifiers', async () => {
        const user = await renderPos();

        await user.type(search(), 'mila{Enter}');

        expect(await screen.findByRole('dialog', { name: 'Milanesa' })).toBeInTheDocument();
        expect(mocked.createOrder).not.toHaveBeenCalled();
      });

      it('adds nothing with Enter on an empty search or without matches', async () => {
        const user = await renderPos();

        await user.type(search(), '{Enter}');
        await user.type(search(), 'zzz{Enter}');

        expect(mocked.createOrder).not.toHaveBeenCalled();
      });

      it('clears the search with Escape', async () => {
        const user = await renderPos();
        await user.type(search(), 'agu');
        expect(screen.queryByRole('button', { name: /^Milanesa/ })).not.toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(search().value).toBe('');
        expect(productButton('Milanesa')).toBeInTheDocument();
      });
    });

    describe('repeat last order', () => {
      const lastOrder = orderWith({
        id: 'order-last',
        items: [
          { ...createdOrder.items[0], quantity: 2, notes: 'Sin sal' },
          { ...withAgua.items[1], quantity: 3 },
        ],
      });
      const repeatedLines = [
        {
          productId: milanesa.id,
          quantity: 2,
          notes: 'Sin sal',
          modifiers: [{ modifierGroupId: guarnicion.id, optionId: papas.id }],
        },
        { productId: 'prod-agua', quantity: 3 },
      ];
      const repeatButton = () => screen.getByRole('button', { name: 'Repetir último pedido' });

      it('is not offered before an order is completed nor while one is in progress', async () => {
        mocked.createOrder.mockResolvedValue(lastOrder);
        const user = await renderPos();
        expect(screen.queryByRole('button', { name: 'Repetir último pedido' })).not.toBeInTheDocument();

        await addAgua(user);

        expect(screen.queryByRole('button', { name: 'Repetir último pedido' })).not.toBeInTheDocument();
      });

      it('re-creates the same lines as a new order after a new order is started', async () => {
        mocked.createOrder.mockResolvedValueOnce(lastOrder).mockResolvedValueOnce({ ...lastOrder, id: 'order-repeat' });
        const user = await renderPos();
        await addAgua(user);
        await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }));

        await user.click(repeatButton());

        await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(2));
        expect(mocked.createOrder).toHaveBeenLastCalledWith('biz-1', {
          sucursalId: 'suc-1',
          type: 'takeaway',
          items: repeatedLines,
        });
        expect(await screen.findByRole('button', { name: 'Quitar Milanesa' })).toBeInTheDocument();
        expect(mocked.addOrderItem).not.toHaveBeenCalled();
      });

      it('is offered after the order is paid and its receipt issued', async () => {
        const paidLast = { ...lastOrder, paymentStatus: 'completed' as const };
        mocked.createOrder.mockResolvedValueOnce(lastOrder).mockResolvedValueOnce({ ...lastOrder, id: 'order-repeat' });
        mocked.registerPayment.mockResolvedValue({ order: paidLast, payments: (shapes['POST orders/:id/payments (rest)'].body as PaymentResult).payments, remaining: 0 });
        mocked.issueReceipt.mockResolvedValue(shapes['POST receipts'].body as never);
        const user = await renderPos();
        await addAgua(user);
        await user.click(screen.getByRole('button', { name: 'Cobrar' }));
        await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
        expect(screen.queryByRole('button', { name: 'Repetir último pedido' })).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Emitir ticket' }));
        await screen.findByRole('region', { name: 'Comprobante' });
        await user.click(repeatButton());

        await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(2));
        expect(mocked.createOrder).toHaveBeenLastCalledWith('biz-1', expect.objectContaining({ items: repeatedLines }));
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Comprobante' })).not.toBeInTheDocument());
        expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
      });

      it('respects the closed caja of the selected sucursal', async () => {
        mocked.getCurrentCashSession.mockImplementation(async (_biz, sucursalId) => (sucursalId === 'suc-1' ? openSession : null));
        mocked.createOrder.mockResolvedValue(lastOrder);
        const user = await renderPos();
        await addAgua(user);
        await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }));

        await user.selectOptions(screen.getByLabelText('Sucursal'), 'suc-2');
        await screen.findByText('Abrí la caja para empezar a vender');

        expect(repeatButton()).toBeDisabled();
        await user.click(repeatButton());
        expect(mocked.createOrder).toHaveBeenCalledTimes(1);
      });
    });

    describe('customer name', () => {
      it('sends the trimmed customer name when the order is created', async () => {
        const user = await renderPos();

        await user.type(screen.getByLabelText('Nombre del cliente'), '  Juana Pérez ');
        await addAgua(user);

        expect(mocked.createOrder).toHaveBeenCalledWith('biz-1', {
          sucursalId: 'suc-1',
          type: 'takeaway',
          customerName: 'Juana Pérez',
          items: [{ productId: 'prod-agua', quantity: 1 }],
        });
        expect(screen.getByLabelText('Nombre del cliente')).toBeDisabled();
      });

      it('clears the customer name when a new order starts', async () => {
        const user = await renderPos();
        await user.type(screen.getByLabelText('Nombre del cliente'), 'Juana');
        await addAgua(user);

        await user.click(screen.getByRole('button', { name: 'Nuevo pedido' }));

        expect((screen.getByLabelText('Nombre del cliente') as HTMLInputElement).value).toBe('');
        expect(screen.getByLabelText('Nombre del cliente')).toBeEnabled();
      });
    });
  });
});
