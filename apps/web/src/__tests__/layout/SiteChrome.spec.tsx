import { render, screen } from '@testing-library/react';
import { SiteChrome } from '@/components/layout/SiteChrome';

let pathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn() }),
}));

describe('SiteChrome', () => {
  it('wraps public pages with the site header and footer', () => {
    pathname = '/';
    render(<SiteChrome><p>contenido</p></SiteChrome>);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('shows the public order screen alone, without site header or footer', () => {
    pathname = '/pantalla/some-token';
    render(<SiteChrome><p>pedidos</p></SiteChrome>);

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByText('pedidos')).toBeInTheDocument();
  });

  it.each(['/dashboard', '/dashboard/pos'])('shows %s with its own header only, without the public site chrome', (path) => {
    pathname = path;
    render(<SiteChrome><p>panel</p></SiteChrome>);

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByText('panel')).toBeInTheDocument();
  });

  it('keeps the site chrome on routes that only share the prefix', () => {
    pathname = '/dashboarding';
    render(<SiteChrome><p>otra</p></SiteChrome>);

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
