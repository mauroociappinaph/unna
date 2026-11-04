import { act, render, screen, within } from '@testing-library/react';
import OrderBoardPage from '@/app/pantalla/[token]/page';
import { getPublicOrderBoard } from '@/lib/public-board-api';
import shapes from '../fixtures/api-shapes.json';
import { fetchCalls, headerOf, jsonResponse, mockFetch } from '../bar/fetch-mock';

const TOKEN = 'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT';
const board = shapes['GET public/order-board/:token'];
const unknown = shapes['GET public/order-board/:token (unknown)'];

let fetchMock: jest.Mock;

const boardCalls = () => fetchCalls(fetchMock, '/public/order-board/');
const area = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  localStorage.setItem('auth_token', 'owner-token');
  fetchMock = mockFetch();
  fetchMock.mockImplementation(async () => jsonResponse(board));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Public order board', () => {
  it('shows the preparing and ready orders with number and name', async () => {
    render(<OrderBoardPage params={{ token: TOKEN }} />);

    expect(await screen.findByText('Central')).toBeInTheDocument();
    const preparing = area('En preparación');
    expect(within(preparing).getAllByRole('listitem')).toHaveLength(5);
    expect(within(preparing).getByText('358')).toBeInTheDocument();
    expect(within(preparing).getByText('Martina')).toBeInTheDocument();
    const ready = area('¡Listos!');
    expect(within(ready).getByText('129')).toBeInTheDocument();
    expect(within(ready).getByText('Juan')).toBeInTheDocument();
  });

  it('calls the public endpoint without an Authorization header', async () => {
    render(<OrderBoardPage params={{ token: TOKEN }} />);
    await screen.findByText('Central');

    const [[url, init]] = boardCalls();
    expect(url).toMatch(new RegExp(`/api/v1/public/order-board/${TOKEN}$`));
    expect(headerOf(init, 'Authorization')).toBeNull();
    expect(init?.credentials).toBe('omit');
  });

  it('shows a generic message when the screen does not exist', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(unknown));
    render(<OrderBoardPage params={{ token: 'nope' }} />);

    expect(await screen.findByText('Pantalla no disponible')).toBeInTheDocument();
    expect(screen.queryByText('Pantalla no encontrada')).not.toBeInTheDocument();
  });

  describe('polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('refreshes every 5 seconds and stops on unmount', async () => {
      const { unmount } = render(<OrderBoardPage params={{ token: TOKEN }} />);
      await screen.findByText('Central');
      expect(boardCalls()).toHaveLength(1);

      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(boardCalls()).toHaveLength(2);

      unmount();
      await act(async () => { jest.advanceTimersByTime(20000); });
      expect(boardCalls()).toHaveLength(2);
    });

    it('keeps the last data on a network error', async () => {
      render(<OrderBoardPage params={{ token: TOKEN }} />);
      await screen.findByText('Juan');

      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await act(async () => { jest.advanceTimersByTime(5000); });
      fetchMock.mockImplementation(async () => jsonResponse({ status: 502, body: {} }));
      await act(async () => { jest.advanceTimersByTime(5000); });

      expect(boardCalls()).toHaveLength(3);
      expect(within(area('¡Listos!')).getByText('Juan')).toBeInTheDocument();
      expect(screen.queryByText('Pantalla no disponible')).not.toBeInTheDocument();
    });
  });
});

describe('getPublicOrderBoard', () => {
  it('sends no Authorization header even with an owner session', async () => {
    fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(board));

    await expect(getPublicOrderBoard(TOKEN)).resolves.toEqual(board.body);

    const [[, init]] = boardCalls();
    expect(headerOf(init, 'Authorization')).toBeNull();
  });

  it('encodes the token in the path', async () => {
    fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(board));

    await getPublicOrderBoard('a/b?c');

    expect(boardCalls()[0][0]).toMatch(/\/public\/order-board\/a%2Fb%3Fc$/);
  });
});
