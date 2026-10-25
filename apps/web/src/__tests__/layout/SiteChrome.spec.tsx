import { render, screen } from '@testing-library/react';
import { SiteChrome } from '@/components/layout/SiteChrome';

let pathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn() }),
}));

describe('SiteChrome', () => {
  it('wraps regular pages with the site header and footer', () => {
    pathname = '/dashboard';
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
});
