'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { QrCode } from '@/components/pos/QrCode';
import type { PedidoAnticipadoSucursal } from '@/lib/api-types';
import { printElement } from '@/lib/print';

interface PedidoSucursalCardProps {
  sucursal: PedidoAnticipadoSucursal;
  busy: boolean;
  onEnable: (sucursalId: string) => void;
  onDisable: (sucursal: PedidoAnticipadoSucursal) => void;
}

/** Pedido anticipado of one sucursal: on/off, and while on, its public link and printable QR. */
export function PedidoSucursalCard({ sucursal, busy, onEnable, onDisable }: PedidoSucursalCardProps) {
  const headingId = `pedido-sucursal-${sucursal.sucursalId}`;
  const printable = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const link = sucursal.enabled ? sucursal.url : null;

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="text-lg font-semibold text-gray-900">{sucursal.name}</h3>
        <span className={`text-sm font-medium ${link ? 'text-unna-green-dark' : 'text-gray-600'}`}>{link ? 'Activo' : 'Desactivado'}</span>
      </div>

      {link ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <code className="break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{link}</code>
            <Button variant="secondary" size="sm" onClick={handleCopy}>{copied ? 'Copiado' : 'Copiar link'}</Button>
          </div>
          {copyError && <p className="text-sm text-red-700">No se pudo copiar. Seleccioná el link y copialo a mano.</p>}
          <div ref={printable} className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 text-center">
            <QrCode data={link} label={`QR del pedido anticipado de ${sucursal.name}`} />
            <p className="font-semibold text-gray-900">Pedí y pagá desde tu celular</p>
            <p className="text-sm text-gray-600">{sucursal.name}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => printable.current && printElement(printable.current)}>Imprimir QR</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onDisable(sucursal)}>Desactivar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Tus clientes piden y pagan con Mercado Pago desde el celular, y retiran en el mostrador.</p>
          <Button size="sm" disabled={busy} onClick={() => onEnable(sucursal.sucursalId)}>Activar pedido anticipado</Button>
        </div>
      )}
    </section>
  );
}
