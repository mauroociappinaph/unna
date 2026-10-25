'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Footer } from './Footer';

/** Routes shown on their own, without the site header and footer (e.g. the TV order screen). */
const BARE_ROUTES = ['/pantalla'];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return <main className="min-h-screen">{children}</main>;
  }
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  );
}
