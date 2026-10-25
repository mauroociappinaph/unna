'use client';

import { useCallback, useState } from 'react';
import { BoardUnavailableError, getPublicOrderBoard, type PublicBoardEntry, type PublicOrderBoard } from '@/lib/public-board-api';
import { usePolling } from './usePolling';

const BOARD_POLL_MS = 5000;

function BoardArea({ title, entries, ready }: { title: string; entries: PublicBoardEntry[]; ready: boolean }) {
  return (
    <section aria-label={title} className={`flex flex-col p-8 ${ready ? 'bg-green-50' : 'bg-white'}`}>
      <h2 className={`text-5xl font-extrabold ${ready ? 'text-unna-green-dark' : 'text-gray-900'}`}>{title}</h2>
      {/* Columns never narrower than a 3-digit number at TV size. */}
      <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-6">
        {entries.map((entry) => (
          <li
            key={entry.shortNumber}
            className={`rounded-3xl border-4 p-6 text-center ${ready ? 'border-unna-green-dark bg-white' : 'border-gray-300 bg-white'}`}
          >
            <p className="text-7xl font-black leading-none text-gray-900 tabular-nums">{entry.shortNumber}</p>
            {entry.name && <p className="mt-3 text-3xl font-semibold text-gray-900 truncate">{entry.name}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** TV screen of a sucursal: public, polls the board and survives transient network errors. */
export function OrderBoard({ token }: { token: string }) {
  const [board, setBoard] = useState<PublicOrderBoard | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await getPublicOrderBoard(token));
      setUnavailable(false);
    } catch (err) {
      // Network or server errors keep the last good board on screen.
      if (err instanceof BoardUnavailableError) {
        setBoard(null);
        setUnavailable(true);
      }
    }
  }, [token]);

  usePolling(load, BOARD_POLL_MS);

  return (
    // Covers the site header and footer of the root layout: the TV shows only the board.
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-gray-900">
      {unavailable ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-5xl font-bold">Pantalla no disponible</p>
        </div>
      ) : !board ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-3xl text-gray-700">Cargando pedidos…</p>
        </div>
      ) : (
        <>
          <header className="border-b-4 border-gray-200 px-8 py-4">
            <p className="text-3xl font-bold">{board.sucursalName}</p>
          </header>
          <div className="grid flex-1 grid-cols-2 divide-x-4 divide-gray-200 overflow-hidden">
            <BoardArea title="En preparación" entries={board.preparing} ready={false} />
            <BoardArea title="¡Listos!" entries={board.ready} ready />
          </div>
        </>
      )}
    </div>
  );
}
