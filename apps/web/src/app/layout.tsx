import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout';
import { Footer } from '@/components/layout';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'FUDO - Todo tu restaurante. Una sola plataforma.',
    template: '%s | FUDO',
  },
  description: 'Gestión, cobros y delivery en un solo lugar. La plataforma gastronómica #1 de Latinoamérica. 35.000+ restaurantes activos. Prueba gratis 15 minutos.',
  keywords: ['restaurante', 'POS', 'gestión gastronómica', 'delivery', 'facturación electrónica', 'comandas', 'stock', 'FUDO'],
  authors: [{ name: 'FUDO' }],
  creator: 'FUDO',
  publisher: 'FUDO',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://fu.do',
    siteName: 'FUDO',
    title: 'FUDO - Todo tu restaurante. Una sola plataforma.',
    description: 'Gestión, cobros y delivery en un solo lugar. La plataforma gastronómica #1 de Latinoamérica.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'FUDO - Plataforma gastronómica',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FUDO - Todo tu restaurante. Una sola plataforma.',
    description: 'Gestión, cobros y delivery en un solo lugar. La plataforma gastronómica #1 de Latinoamérica.',
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
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}