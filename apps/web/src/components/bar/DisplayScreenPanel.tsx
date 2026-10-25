'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/catalog/ErrorBanner';
import { apiErrorMessage } from '@/lib/api-errors';
import { createDisplayToken, revokeDisplayToken } from '@/lib/order-board-api';

interface DisplayScreenPanelProps {
  businessId: string;
  sucursalId: string;
}

/**
 * Generates or revokes the public screen link of a sucursal. The link lives only
 * in component state: it is shown once and never persisted in the browser.
 */
export function DisplayScreenPanel({ businessId, sucursalId }: DisplayScreenPanelProps) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = () =>
    run(async () => {
      const { path } = await createDisplayToken(businessId, sucursalId);
      setLink(`${window.location.origin}${path}`);
      setCopied(false);
    }, 'No se pudo generar el enlace');

  const handleDisable = () =>
    run(async () => {
      await revokeDisplayToken(businessId, sucursalId);
      setLink(null);
      setNotice('Pantalla desactivada. El enlace anterior ya no funciona.');
    }, 'No se pudo desactivar la pantalla');

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('No se pudo copiar. Seleccioná el enlace y copialo a mano.');
    }
  };

  return (
    <section aria-label="Pantalla de pedidos" className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900">Pantalla de pedidos</h2>
      <p className="mt-1 text-gray-600">
        Mostrá en una tele los pedidos en preparación y los listos para retirar. Solo se ve el número y el primer nombre.
      </p>

      <ErrorBanner message={error} />

      {link && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">Abrí este enlace en la pantalla:</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="break-all rounded-lg bg-white px-3 py-2 text-sm text-gray-900 border border-gray-200">{link}</code>
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? 'Copiado' : 'Copiar enlace'}
            </Button>
          </div>
          <p className="mt-3 text-sm text-amber-800">
            Guardalo ahora: no lo vas a poder ver de nuevo. Si generás uno nuevo, el enlace anterior deja de funcionar.
          </p>
        </div>
      )}

      {notice && <p className="mt-4 text-sm text-gray-700" role="status">{notice}</p>}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button size="sm" disabled={busy} onClick={handleGenerate}>Generar enlace de pantalla</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={handleDisable}>Desactivar pantalla</Button>
      </div>
    </section>
  );
}
