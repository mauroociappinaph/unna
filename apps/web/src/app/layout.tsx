import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteChrome } from '@/components/layout/SiteChrome';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'UNNA - El sistema para cafés take away. A Community of Sharing',
    template: '%s | UNNA',
  },
  description: 'Vendé rápido en el mostrador, cobrá fácil y controlá tus cobros y tu stock. El sistema para cafés take away, cafés de especialidad y cadenas de cafés.',
  keywords: ['café take away', 'cafetería', 'café de especialidad', 'POS', 'punto de venta', 'mostrador', 'stock', 'UNNA'],
  authors: [{ name: 'UNNA' }],
  creator: 'UNNA',
  publisher: 'UNNA',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://unna',
    siteName: 'UNNA',
    title: 'UNNA - El sistema para cafés take away. A Community of Sharing',
    description: 'Vendé rápido en el mostrador, cobrá fácil y controlá tus cobros y tu stock. El sistema para cafés take away, cafés de especialidad y cadenas de cafés.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'UNNA - El sistema para cafés take away',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNNA - El sistema para cafés take away. A Community of Sharing',
    description: 'Vendé rápido en el mostrador, cobrá fácil y controlá tus cobros y tu stock. El sistema para cafés take away, cafés de especialidad y cadenas de cafés.',
    images: ['/og-image.jpg'],
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}