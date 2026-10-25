import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisplayScreenPanel } from '@/components/bar/DisplayScreenPanel';
import shapes from '../fixtures/api-shapes.json';
import { fetchCalls, headerOf, jsonResponse, mockFetch } from './fetch-mock';

const TOKEN_PATH = '/businesses/biz-1/sucursales/suc-1/display-token';
const created = shapes['POST sucursales/:id/display-token'];
const fullUrl = `${window.location.origin}${created.body.path}`;

let fetchMock: jest.Mock;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('auth_token', 'token');
  fetchMock = mockFetch();
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    jsonResponse(init?.method === 'DELETE' ? shapes['DELETE sucursales/:id/display-token'] : created));
});

const renderPanel = () => {
  const user = userEvent.setup();
  const view = render(<DisplayScreenPanel businessId="biz-1" sucursalId="suc-1" />);
  return { user, ...view };
};

describe('DisplayScreenPanel', () => {
  it('generates the link and shows the full URL with a warning', async () => {
    const { user } = renderPanel();
    expect(screen.queryByText(fullUrl)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generar enlace de pantalla' }));

    expect(await screen.findByText(fullUrl)).toBeInTheDocument();
    expect(screen.getByText(/el enlace anterior deja de funcionar/)).toBeInTheDocument();
    const [[url, init]] = fetchCalls(fetchMock, TOKEN_PATH, 'POST');
    expect(url).toMatch(/\/api\/v1\/businesses\/biz-1\/sucursales\/suc-1\/display-token$/);
    expect(headerOf(init, 'Authorization')).toBe('Bearer token');
  });

  it('copies the URL', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Generar enlace de pantalla' }));
    await screen.findByText(fullUrl);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    expect(await navigator.clipboard.readText()).toBe(fullUrl);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('never stores the token and does not show it again after a remount', async () => {
    const { user, unmount } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Generar enlace de pantalla' }));
    await screen.findByText(fullUrl);

    const stored = Object.keys(localStorage).map((key) => localStorage.getItem(key)).join(' ');
    expect(stored).not.toContain(created.body.token);

    unmount();
    renderPanel();
    expect(screen.queryByText(fullUrl)).not.toBeInTheDocument();
  });

  it('deactivates the screen with DELETE and hides the link', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Generar enlace de pantalla' }));
    await screen.findByText(fullUrl);

    await user.click(screen.getByRole('button', { name: 'Desactivar pantalla' }));

    expect(await screen.findByText(/Pantalla desactivada/)).toBeInTheDocument();
    expect(screen.queryByText(fullUrl)).not.toBeInTheDocument();
    const [[, init]] = fetchCalls(fetchMock, TOKEN_PATH, 'DELETE');
    expect(headerOf(init, 'Authorization')).toBe('Bearer token');
  });

  it('shows the API message when generating fails', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ status: 404, body: { message: 'Sucursal no encontrada', statusCode: 404 } }));
    const { user } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Generar enlace de pantalla' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sucursal no encontrada'));
  });
});
