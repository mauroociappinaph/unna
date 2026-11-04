import type { Metadata } from 'next';

// The token in the URL is a secret: keep the screen out of search engines and referrers.
export const metadata: Metadata = {
  title: 'Pedidos',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function PantallaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
