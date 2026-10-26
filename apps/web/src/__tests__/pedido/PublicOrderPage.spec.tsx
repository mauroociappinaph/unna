import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicOrderRoute from '@/app/pedido/[slug]/page';
import { formatMoney } from '@/lib/api-types';
import { redirectTo } from '@/lib/navigation';
import { fetchCalls, headerOf, jsonResponse, mockFetch } from '../bar/fetch-mock';
import { SLUG, TRACKING_TOKEN, closedMenu, menu } from './pedido-fixtures';

// Testing Library collapses the non-breaking space formatMoney emits.
const shown = (cents: number) => formatMoney(cents).replace(/\s/g, ' ');

jest.mock('@/lib/navigation', () => ({ redirectTo: jest.fn() }));

const CHECKOUT_URL = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=ORD01';

let fetchMock: jest.Mock;
let checkoutReply: { status: number; body: unknown };

const menuCalls = () => fetchCalls(fetchMock, `/public/pedido/${SLUG}`).filter(([url]) => !url.includes('/checkouts'));
const checkoutCalls = () => fetchCalls(fetchMock, `/public/pedido/${SLUG}/checkouts`, 'POST');
const cart = () => screen.getByRole('region', { name: 'Tu pedido' });

function setup(menuReply: { status: number; body: unknown } = { status: 200, body: menu }) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/checkouts') && init?.method === 'POST') return jsonResponse(checkoutReply);
    return jsonResponse(menuReply);
  });
  const user = userEvent.setup();
  render(<PublicOrderRoute params={{ slug: SLUG }} />);
  return user;
}

async function addLatte(user: ReturnType<typeof userEvent.setup>, options: string[]) {
  await user.click(await screen.findByRole('button', { name: 'Agregar Latte' }));
  const dialog = screen.getByRole('dialog', { name: 'Latte' });
  for (const option of options) await user.click(within(dialog).getByLabelText(option));
  await user.click(within(dialog).getByRole('button', { name: /Agregar al pedido/ }));
}

beforeEach(() => {
  jest.clearAllMocks();
  // An owner session in the same browser must never reach the public endpoints.
  localStorage.setItem('auth_token', 'owner-token');
  fetchMock = mockFetch();
  checkoutReply = { status: 201, body: { trackingToken: TRACKING_TOKEN, checkoutUrl: CHECKOUT_URL, total: 470000 } };
});

describe('Public order page: menu', () => {
  it('shows the café, the sucursal and the products by category with their prices', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'Café Lunes' })).toBeInTheDocument();
    expect(screen.getByText('Palermo')).toBeInTheDocument();
    const cafes = screen.getByRole('region', { name: 'Cafés' });
    expect(within(cafes).getByText('Latte')).toBeInTheDocument();
    expect(within(cafes).getByText(shown(300000))).toBeInTheDocument();
    const bakery = screen.getByRole('region', { name: 'Panadería' });
    expect(within(bakery).getByText('Medialuna')).toBeInTheDocument();
    expect(within(bakery).getByText(shown(80000))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeInTheDocument();
  });

  it('explains why the local is not taking orders and offers no checkout', async () => {
    setup({ status: 200, body: closedMenu });

    expect(await screen.findByText('El local está cerrado en este momento')).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Agregar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tu nombre')).not.toBeInTheDocument();
  });

  it('shows the backend message when the link does not exist', async () => {
    setup({ status: 404, body: { statusCode: 404, message: 'Este local no recibe pedidos anticipados' } });

    expect(await screen.findByText('Este local no recibe pedidos anticipados')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).not.toBeInTheDocument();
  });

  it('calls the menu endpoint without an Authorization header or credentials', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Café Lunes' });

    const [[url, init]] = menuCalls();
    expect(url).toMatch(new RegExp(`/api/v1/public/pedido/${SLUG}$`));
    expect(headerOf(init, 'Authorization')).toBeNull();
    expect(init?.credentials).toBe('omit');
  });
});

describe('Public order page: modifiers', () => {
  it('requires the mandatory group before adding the product', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'Agregar Latte' }));
    const dialog = screen.getByRole('dialog', { name: 'Latte' });

    expect(within(dialog).getByRole('button', { name: /Agregar al pedido/ })).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Entera'));
    expect(within(dialog).getByRole('button', { name: /Agregar al pedido/ })).toBeEnabled();
  });

  it('keeps a single choice when the group allows only one', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'Agregar Latte' }));
    const dialog = screen.getByRole('dialog', { name: 'Latte' });

    await user.click(within(dialog).getByLabelText('Entera'));
    await user.click(within(dialog).getByLabelText('Avena'));

    expect(within(dialog).getByLabelText('Avena')).toBeChecked();
    expect(within(dialog).getByLabelText('Entera')).not.toBeChecked();
  });

  it('blocks more options than the maximum of the group', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'Agregar Latte' }));
    const dialog = screen.getByRole('dialog', { name: 'Latte' });

    await user.click(within(dialog).getByLabelText('Shot extra'));
    await user.click(within(dialog).getByLabelText('Canela'));

    expect(within(dialog).getByLabelText('Vainilla')).toBeDisabled();
    expect(within(dialog).getByText('Opcional · hasta 2')).toBeInTheDocument();
  });

  it('adds the product with its options and their price to the cart', async () => {
    const user = setup();
    await addLatte(user, ['Avena', 'Shot extra']);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(cart()).getByText('Latte')).toBeInTheDocument();
    expect(within(cart()).getByText('Avena, Shot extra')).toBeInTheDocument();
    expect(within(cart()).getAllByText(shown(390000)).length).toBeGreaterThan(0);
  });

  it('closes the sheet without adding anything', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'Agregar Latte' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Latte' })).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(cart()).getByText('Todavía no agregaste productos.')).toBeInTheDocument();
  });
});

describe('Public order page: cart', () => {
  it('adds products without options directly and sums quantities into the total', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'Agregar Medialuna' }));
    await user.click(screen.getByRole('button', { name: 'Agregar Medialuna' }));
    await addLatte(user, ['Avena']);

    expect(within(cart()).getByText('2')).toBeInTheDocument();
    // 2 × 800 + (3000 + 500)
    expect(within(cart()).getByTestId('cart-total')).toHaveTextContent(shown(510000));

    await user.click(within(cart()).getByRole('button', { name: 'Quitar uno de Medialuna' }));
    expect(within(cart()).getByTestId('cart-total')).toHaveTextContent(shown(430000));

    await user.click(within(cart()).getByRole('button', { name: 'Quitar uno de Medialuna' }));
    expect(within(cart()).queryByText('Medialuna')).not.toBeInTheDocument();
    expect(within(cart()).getByTestId('cart-total')).toHaveTextContent(shown(350000));
  });

  it('shows final prices with IVA and totals them like the server (IVA per line, rounded)', async () => {
    const taxed = { ...menu, products: menu.products.map((p) => (p.id === 'p-2' ? { ...p, price: 80001, taxRate: 21 } : p)) };
    const user = setup({ status: 200, body: taxed });

    const bakery = await screen.findByRole('region', { name: 'Panadería' });
    // 800,01 + 21 % (168,0021 → 168,00)
    expect(within(bakery).getByText(shown(96801))).toBeInTheDocument();
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole('button', { name: 'Agregar Medialuna' }));

    // 3 × 800,01 = 2400,03 + 21 % on the line (504,0063 → 504,01)
    expect(within(cart()).getByTestId('cart-total')).toHaveTextContent(shown(240003 + 50401));
  });

  it('keeps different options of the same product in separate lines', async () => {
    const user = setup();
    await addLatte(user, ['Entera']);
    await addLatte(user, ['Avena']);
    await addLatte(user, ['Avena']);

    expect(within(cart()).getAllByText('Latte')).toHaveLength(2);
    expect(within(cart()).getByTestId('cart-total')).toHaveTextContent(shown(300000 + 2 * 350000));
  });

  it('does not go over 20 units of a line', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'Agregar Medialuna' }));
    const more = within(cart()).getByRole('button', { name: 'Sumar uno de Medialuna' });
    for (let i = 1; i < 20; i += 1) await user.click(more);

    expect(more).toBeDisabled();
    expect(within(cart()).getByText('20')).toBeInTheDocument();
  });
});

describe('Public order page: checkout', () => {
  async function fillCart(user: ReturnType<typeof userEvent.setup>) {
    await addLatte(user, ['Avena', 'Shot extra']);
    await user.click(screen.getByRole('button', { name: 'Agregar Medialuna' }));
    await user.click(within(cart()).getByRole('button', { name: 'Sumar uno de Medialuna' }));
  }

  it('posts the exact contract body without auth and goes to the Mercado Pago checkout', async () => {
    const user = setup();
    await fillCart(user);
    await user.type(screen.getByLabelText('Tu nombre'), '  Martina Pérez ');
    await user.click(screen.getByRole('button', { name: 'Pagar con Mercado Pago' }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith(CHECKOUT_URL));
    const [[url, init]] = checkoutCalls();
    expect(url).toMatch(new RegExp(`/api/v1/public/pedido/${SLUG}/checkouts$`));
    expect(JSON.parse(String(init?.body))).toEqual({
      customerName: 'Martina Pérez',
      items: [
        {
          productId: 'p-1',
          quantity: 1,
          modifiers: [
            { modifierGroupId: 'g-milk', optionId: 'o-oat' },
            { modifierGroupId: 'g-extras', optionId: 'o-shot' },
          ],
        },
        { productId: 'p-2', quantity: 2 },
      ],
    });
    expect(headerOf(init, 'Content-Type')).toBe('application/json');
    expect(headerOf(init, 'Authorization')).toBeNull();
    expect(init?.credentials).toBe('omit');
  });

  it('lets the customer pay again after coming back from Mercado Pago with the back button', async () => {
    const user = setup();
    await fillCart(user);
    await user.type(screen.getByLabelText('Tu nombre'), 'Martina');
    await user.click(screen.getByRole('button', { name: /Pagar con Mercado Pago/ }));
    await waitFor(() => expect(redirectTo).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /Pagar con Mercado Pago/ })).toBeDisabled();

    // The browser restores the page from its back-forward cache.
    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    act(() => {
      window.dispatchEvent(restored);
    });

    expect(screen.getByRole('button', { name: /Pagar con Mercado Pago/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Pagar con Mercado Pago/ }));
    await waitFor(() => expect(redirectTo).toHaveBeenCalledTimes(2));
  });

  it('asks for the name and does not post without it', async () => {
    const user = setup();
    await fillCart(user);
    await user.type(screen.getByLabelText('Tu nombre'), '   ');
    await user.click(screen.getByRole('button', { name: 'Pagar con Mercado Pago' }));

    expect(await screen.findByText('Ingresá tu nombre para retirar el pedido')).toBeInTheDocument();
    expect(checkoutCalls()).toHaveLength(0);
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('limits the name to 40 characters', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Café Lunes' });
    const name = screen.getByLabelText('Tu nombre');
    await user.type(name, 'x'.repeat(45));

    expect(name).toHaveAttribute('maxLength', '40');
    expect(name).toHaveValue('x'.repeat(40));
  });

  it('cannot pay an empty cart', async () => {
    setup();

    expect(await screen.findByRole('button', { name: 'Pagar con Mercado Pago' })).toBeDisabled();
  });

  it('shows the backend error and stays on the page', async () => {
    checkoutReply = { status: 400, body: { statusCode: 400, message: 'Algún producto ya no está disponible' } };
    const user = setup();
    await fillCart(user);
    await user.type(screen.getByLabelText('Tu nombre'), 'Martina');
    await user.click(screen.getByRole('button', { name: 'Pagar con Mercado Pago' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Algún producto ya no está disponible');
    expect(redirectTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeEnabled();
    expect(within(cart()).getByText('Latte')).toBeInTheDocument();
  });

  it('explains a rate limit without a backend message', async () => {
    checkoutReply = { status: 429, body: {} };
    const user = setup();
    await fillCart(user);
    await user.type(screen.getByLabelText('Tu nombre'), 'Martina');
    await user.click(screen.getByRole('button', { name: 'Pagar con Mercado Pago' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Hay muchos pedidos en este momento. Esperá un minuto y probá de nuevo.');
    expect(redirectTo).not.toHaveBeenCalled();
  });
});
