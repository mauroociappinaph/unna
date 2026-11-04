'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Footer } from './Footer';
import { StagingBanner } from './StagingBanner';

/**
 * Routes shown without the public site header and footer: the TV order screen, the dashboard,
 * which has its own header with the business navigation and logout, and the customer order pages,
 * which show the café's own minimal header.
 */
const BARE_ROUTES = ['/pantalla', '/dashboard', '/pedido'];

/** The TV order screen also goes without the staging banner, so nothing covers the board. */
const NO_BANNER_ROUTES = ['/pantalla'];

const matches = (pathname: string, routes: string[]) => routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const banner = matches(pathname, NO_BANNER_ROUTES) ? null : <StagingBanner />;
  if (matches(pathname, BARE_ROUTES)) {
    return (
      <>
        <main className="min-h-screen">{children}</main>
        {banner}
      </>
    );
  }
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
      {banner}
    </div>
  );
}
