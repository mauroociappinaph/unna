const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1`;

export interface PublicBoardEntry {
  shortNumber: string;
  name: string | null;
  status: 'preparing' | 'ready';
}

export interface PublicOrderBoard {
  sucursalName: string;
  preparing: PublicBoardEntry[];
  ready: PublicBoardEntry[];
  updatedAt: string;
}

/** The token is unknown or was revoked; the API gives no further detail. */
export class BoardUnavailableError extends Error {
  constructor() {
    super('Pantalla no disponible');
  }
}

/** Public screen: plain fetch, no headers and no credentials, so no session ever leaves the browser. */
export async function getPublicOrderBoard(token: string): Promise<PublicOrderBoard> {
  const response = await fetch(`${API_BASE}/public/order-board/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    credentials: 'omit',
  });
  if (response.status === 404) throw new BoardUnavailableError();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
