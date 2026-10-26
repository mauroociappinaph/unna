import { act, render, screen, within } from '@testing-library/react';
import TrackingRoute from '@/app/pedido/seguimiento/[token]/page';
import { metadata } from '@/app/pedido/seguimiento/layout';
import { formatMoney } from '@/lib/api-types';
import type { OrderTracking, TrackingStatus } from '@/lib/public-order-api';
import { fetchCalls, headerOf, jsonResponse, mockFetch } from '../bar/fetch-mock';
import { TRACKING_TOKEN, tracking } from './pedido-fixtures';

// Testing Library collapses the non-breaking space formatMoney emits.
const shown = (cents: number) => formatMoney(cents).replace(/\s/g, ' ');

let fetchMock: jest.Mock;
let reply: { status: number; body: unknown };

const trackingCalls = () => fetchCalls(fetchMock, '/public/pedido/seguimiento/');
const steps = () => screen.getByRole('list', { name: 'Estado del pedido' });
const currentStep = () => within(steps()).getAllByRole('listitem').find((item) => item.getAttribute('aria-current') === 'step');

const replyWith = (body: OrderTracking) => {
  reply = { status: 200, body };
};

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function renderPage() {
  return render(<TrackingRoute params={{ token: TRACKING_TOKEN }} />);
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'owner-token');
  fetchMock = mockFetch();
  replyWith(tracking());
  fetchMock.mockImplementation(async () => jsonResponse(reply));
});

afterEach(() => {
  jest.useRealTimers();
  setVisibility('visible');
});

describe('Tracking page', () => {
  it('shows the order number, name, sucursal, items, total and estimated time', async () => {
    renderPage();

    expect(await screen.findByText('042')).toBeInTheDocument();
    expect(screen.getByText(/Martina/)).toBeInTheDocument();
    expect(screen.getByText(/Palermo/)).toBeInTheDocument();
    expect(screen.getByText('Latte × 1')).toBeInTheDocument();
    expect(screen.getByText('Medialuna × 2')).toBeInTheDocument();
    expect(screen.getByText(shown(460000))).toBeInTheDocument();
    expect(screen.getByText('Listo en unos 10 min')).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent('Recibido');
  });

  it.each<[TrackingStatus, string]>([
    ['awaiting_payment', 'Pago pendiente'],
    ['received', 'Recibido'],
    ['preparing', 'En preparación'],
    ['ready', 'Listo para retirar'],
  ])('marks %s as the step %s', async (status, label) => {
    replyWith(tracking({ status, orderNumber: status === 'awaiting_payment' ? null : '042' }));
    renderPage();

    await screen.findByRole('list', { name: 'Estado del pedido' });
    expect(within(steps()).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Pago pendiente',
      'Recibido',
      'En preparación',
      'Listo para retirar',
    ]);
    expect(currentStep()).toHaveTextContent(label);
  });

  it('shows no estimated time without one', async () => {
    replyWith(tracking({ status: 'ready', estimatedMinutes: null }));
    renderPage();

    expect(await screen.findByText('¡Tu pedido está listo! Acercate a retirarlo.')).toBeInTheDocument();
    expect(screen.queryByText(/Listo en unos/)).not.toBeInTheDocument();
  });

  it('calls the tracking endpoint without an Authorization header or credentials', async () => {
    renderPage();
    await screen.findByText('042');

    const [[url, init]] = trackingCalls();
    expect(url).toMatch(new RegExp(`/api/v1/public/pedido/seguimiento/${TRACKING_TOKEN}$`));
    expect(headerOf(init, 'Authorization')).toBeNull();
    expect(init?.credentials).toBe('omit');
  });

  it('shows the backend message for an unknown token', async () => {
    reply = { status: 404, body: { statusCode: 404, message: 'Pedido no encontrado' } };
    renderPage();

    expect(await screen.findByText('Pedido no encontrado')).toBeInTheDocument();
  });

  it('keeps the page out of search engines and referrers', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe('no-referrer');
  });

  describe('polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    const tick = () => act(async () => { jest.advanceTimersByTime(5000); });

    it('refreshes every 5 seconds and follows the status', async () => {
      replyWith(tracking({ status: 'awaiting_payment', orderNumber: null }));
      renderPage();
      await screen.findByRole('list', { name: 'Estado del pedido' });
      expect(currentStep()).toHaveTextContent('Pago pendiente');

      replyWith(tracking({ status: 'preparing' }));
      await tick();
      expect(trackingCalls()).toHaveLength(2);
      expect(currentStep()).toHaveTextContent('En preparación');

      replyWith(tracking({ status: 'ready' }));
      await tick();
      expect(trackingCalls()).toHaveLength(3);
      expect(currentStep()).toHaveTextContent('Listo para retirar');
    });

    it.each<[TrackingStatus, string]>([
      ['payment_failed', 'El pago no se completó'],
      ['expired', 'El pedido venció sin pago'],
      ['cancelled', 'El pedido fue cancelado'],
      ['delivered', 'Pedido entregado'],
    ])('stops polling on %s and says "%s"', async (status, message) => {
      renderPage();
      await screen.findByText('042');

      replyWith(tracking({ status, orderNumber: status === 'delivered' || status === 'cancelled' ? '042' : null }));
      await tick();
      expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
      expect(trackingCalls()).toHaveLength(2);

      await tick();
      await tick();
      expect(trackingCalls()).toHaveLength(2);
    });

    it('stops polling for an unknown token', async () => {
      reply = { status: 404, body: { statusCode: 404, message: 'Pedido no encontrado' } };
      renderPage();
      await screen.findByText('Pedido no encontrado');

      await tick();
      await tick();
      expect(trackingCalls()).toHaveLength(1);
    });

    it('keeps the last status on a network error', async () => {
      renderPage();
      await screen.findByText('042');

      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await tick();

      expect(screen.getByText('042')).toBeInTheDocument();
      expect(currentStep()).toHaveTextContent('Recibido');
      await tick();
      expect(trackingCalls()).toHaveLength(3);
    });

    it('pauses while the tab is hidden and refreshes when it is visible again', async () => {
      renderPage();
      await screen.findByText('042');

      setVisibility('hidden');
      await tick();
      await tick();
      expect(trackingCalls()).toHaveLength(1);

      replyWith(tracking({ status: 'ready' }));
      await act(async () => { setVisibility('visible'); });
      expect(trackingCalls()).toHaveLength(2);
      expect(currentStep()).toHaveTextContent('Listo para retirar');
    });

    it('stops on unmount', async () => {
      const { unmount } = renderPage();
      await screen.findByText('042');

      unmount();
      await tick();
      expect(trackingCalls()).toHaveLength(1);
    });
  });
});
