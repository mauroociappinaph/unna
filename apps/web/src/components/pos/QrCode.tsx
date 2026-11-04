import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

interface QrCodeProps {
  data: string;
  label: string;
}

/** Renders a QR payload (e.g. the EMVCo string of a Mercado Pago order) as an SVG image. */
export function QrCode({ data, label }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(data, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => {
        if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!src) return <div className="w-56 h-56 bg-gray-100 rounded-xl animate-pulse" aria-hidden="true" />;
  return <Image src={src} alt={label} width={224} height={224} unoptimized className="w-56 h-56" />;
}
