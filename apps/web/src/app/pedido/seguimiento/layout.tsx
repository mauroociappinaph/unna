import type { Metadata } from 'next';

// The tracking token in the URL is a secret: keep the page out of search engines and referrers.
export const metadata: Metadata = {
  title: 'Seguimiento del pedido',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SeguimientoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
