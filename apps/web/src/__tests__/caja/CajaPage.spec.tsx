import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CajaPage from '@/app/dashboard/caja/page';
import { api } from '@/lib/api';
import { formatMoney, type CashSession } from '@/lib/api-types';
import shapes from '../fixtures/api-shapes.json';

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/lib/api', () => ({
  api: {
    getBusinesses: jest.fn(),
    getCurrentCashSession: jest.fn(),
    listCashSessions: jest.fn(),
    getCashSession: jest.fn(),
    openCashSession: jest.fn(),
    addCashMovement: jest.fn(),
    closeCashSession: jest.fn(),
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

const opened = shapes['POST cash-sessions'].body as CashSession;
const withMovement = shapes['POST cash-sessions/:id/movements'].body as CashSession;
const closed = shapes['POST cash-sessions/:id/close'].body as CashSession;
const closedDetail = shapes['GET cash-sessions/:id (closed)'].body as CashSession;
const history = shapes['GET cash-sessions'].body as CashSession[];

// Testing Library collapses the non-breaking space formatMoney emits.
const shown = (cents: number) => formatMoney(cents).replace(/\s/g, ' ');
const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

async function renderCaja() {
  const user = userEvent.setup();
  render(<CajaPage />);
  await waitFor(() => expect(mocked.getCurrentCashSession).toHaveBeenCalled());
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('auth_token', 'token');
  mocked.getBusinesses.mockResolvedValue([business]);
  mocked.getCurrentCashSession.mockResolvedValue(null);
  mocked.listCashSessions.mockResolvedValue([]);
});

describe('Caja page', () => {
  it('redirects to login without a token', async () => {
    localStorage.removeItem('auth_token');
    render(<CajaPage />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
  });

  it('preselects the main sucursal and loads its current session and history', async () => {
    await renderCaja();

    expect((screen.getByLabelText('Sucursal') as HTMLSelectElement).value).toBe('suc-1');
    expect(mocked.getCurrentCashSession).toHaveBeenCalledWith('biz-1', 'suc-1');
    expect(mocked.listCashSessions).toHaveBeenCalledWith('biz-1', { sucursalId: 'suc-1' });
  });

  it('opens the caja sending the fondo inicial in cents', async () => {
    mocked.openCashSession.mockResolvedValue(opened);
    const user = await renderCaja();

    await user.type(await screen.findByLabelText('Fondo inicial ($)'), '5.000');
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }));

    await waitFor(() => expect(mocked.openCashSession).toHaveBeenCalledWith('biz-1', { sucursalId: 'suc-1', openingAmount: 500000 }));
    const summary = await screen.findByRole('region', { name: 'Caja abierta' });
    expect(within(summary).getByText(shown(500000))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir caja' })).not.toBeInTheDocument();
  });

  it('rejects an invalid fondo without calling the API', async () => {
    const user = await renderCaja();

    await user.type(await screen.findByLabelText('Fondo inicial ($)'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }));

    expect(await screen.findByText('Ingresá un monto válido en pesos.')).toBeInTheDocument();
    expect(mocked.openCashSession).not.toHaveBeenCalled();
  });

  it('shows the API error when opening fails', async () => {
    mocked.openCashSession.mockRejectedValue(apiError('Ya hay una caja abierta en esta sucursal'));
    const user = await renderCaja();

    await user.type(await screen.findByLabelText('Fondo inicial ($)'), '0');
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }));

    expect(await screen.findByText('Ya hay una caja abierta en esta sucursal')).toBeInTheDocument();
  });

  it('loads the session of another sucursal when it changes', async () => {
    const user = await renderCaja();

    await user.selectOptions(screen.getByLabelText('Sucursal'), 'suc-2');

    await waitFor(() => expect(mocked.getCurrentCashSession).toHaveBeenLastCalledWith('biz-1', 'suc-2'));
    expect(mocked.listCashSessions).toHaveBeenLastCalledWith('biz-1', { sucursalId: 'suc-2' });
  });

  describe('with an open session', () => {
    beforeEach(() => {
      mocked.getCurrentCashSession.mockResolvedValue(opened);
    });

    it('adds a retiro in cents and lists it', async () => {
      mocked.addCashMovement.mockResolvedValue(withMovement);
      const user = await renderCaja();

      await user.selectOptions(await screen.findByLabelText('Tipo de movimiento'), 'out');
      await user.type(screen.getByLabelText('Monto del movimiento ($)'), '200');
      await user.type(screen.getByLabelText('Motivo'), 'Proveedor de leche');
      await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }));

      await waitFor(() =>
        expect(mocked.addCashMovement).toHaveBeenCalledWith('biz-1', opened.id, { type: 'out', amount: 20000, reason: 'Proveedor de leche' }),
      );
      const movements = await screen.findByRole('region', { name: 'Movimientos' });
      expect(within(movements).getByText('Proveedor de leche')).toBeInTheDocument();
      expect(within(movements).getByText('Retiro')).toBeInTheDocument();
      expect(within(movements).getByText(shown(20000))).toBeInTheDocument();
    });

    it('requires a reason for the movement', async () => {
      const user = await renderCaja();

      await user.type(await screen.findByLabelText('Monto del movimiento ($)'), '200');
      await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }));

      expect(await screen.findByText('Indicá el motivo del movimiento.')).toBeInTheDocument();
      expect(mocked.addCashMovement).not.toHaveBeenCalled();
    });

    it('closes with the declared amount per method and shows expected, declared and difference', async () => {
      const result = { ...closed, declared: { ...closed.declared, cash: 1197100 }, difference: { ...closed.difference, cash: 0 } };
      mocked.closeCashSession.mockResolvedValue(result);
      mocked.listCashSessions.mockResolvedValueOnce([]).mockResolvedValueOnce([result]);
      const user = await renderCaja();

      for (const label of ['Efectivo', 'Tarjeta', 'Mercado Pago', 'Transferencia', 'QR']) {
        expect(await screen.findByLabelText(`${label} ($)`)).toBeInTheDocument();
      }
      await user.type(screen.getByLabelText('Efectivo ($)'), '11.971');
      await user.type(screen.getByLabelText('Mercado Pago ($)'), '0');
      await user.type(screen.getByLabelText('Notas del cierre'), 'Sin novedades');
      await user.click(screen.getByRole('button', { name: 'Cerrar caja' }));

      await waitFor(() =>
        expect(mocked.closeCashSession).toHaveBeenCalledWith('biz-1', opened.id, {
          declared: { cash: 1197100, card: 0, mercado_pago: 0, transfer: 0, qr: 0 },
          notes: 'Sin novedades',
        }),
      );

      const closing = await screen.findByRole('region', { name: 'Arqueo de caja' });
      const cashRow = within(closing).getByRole('row', { name: /Efectivo/ });
      expect(within(cashRow).getAllByText(shown(1197100))).toHaveLength(2);
      expect(within(cashRow).queryByText('Faltante')).not.toBeInTheDocument();
      const cardRow = within(closing).getByRole('row', { name: /Tarjeta/ });
      expect(within(cardRow).getByText(shown(310400))).toBeInTheDocument();
      expect(within(cardRow).getByText(shown(-310400))).toBeInTheDocument();
      expect(within(cardRow).getByText('Faltante')).toBeInTheDocument();

      // The caja is closed: the open form is back and the history refreshed.
      expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeInTheDocument();
      await waitFor(() => expect(mocked.listCashSessions).toHaveBeenCalledTimes(2));
    });

    it('rejects an invalid declared amount without calling the API', async () => {
      const user = await renderCaja();

      await user.type(await screen.findByLabelText('Tarjeta ($)'), '12,345');
      await user.click(screen.getByRole('button', { name: 'Cerrar caja' }));

      expect(await screen.findByText('Ingresá montos válidos en pesos.')).toBeInTheDocument();
      expect(mocked.closeCashSession).not.toHaveBeenCalled();
    });
  });

  it('lists past sessions and shows the detail of one', async () => {
    mocked.listCashSessions.mockResolvedValue(history);
    mocked.getCashSession.mockResolvedValue(closedDetail);
    const user = await renderCaja();

    const list = await screen.findByRole('region', { name: 'Historial de cajas' });
    await user.click(within(list).getByRole('button', { name: /Ver detalle/ }));

    await waitFor(() => expect(mocked.getCashSession).toHaveBeenCalledWith('biz-1', closedDetail.id));
    const closing = await screen.findByRole('region', { name: 'Arqueo de caja' });
    const cashRow = within(closing).getByRole('row', { name: /Efectivo/ });
    expect(within(cashRow).getByText(shown(-1197100))).toBeInTheDocument();
    expect(within(cashRow).getByText('Faltante')).toBeInTheDocument();
  });
});
