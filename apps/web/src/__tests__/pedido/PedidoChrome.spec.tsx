import { render, screen } from '@testing-library/react';
import { SiteChrome } from '@/components/layout/SiteChrome';

let pathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn() }),
}));

describe('SiteChrome on the public order pages', () => {
  it.each(['/pedido/AbCdEfGhIjKlMnOp12', '/pedido/seguimiento/some-token'])(
    'shows %s without the UNNA marketing header and footer',
    (path) => {
      pathname = path;
      render(<SiteChrome><p>pedido</p></SiteChrome>);

      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
      expect(screen.getByText('pedido')).toBeInTheDocument();
    },
  );

  it('keeps the site chrome on routes that only share the prefix', () => {
    pathname = '/pedidos';
    render(<SiteChrome><p>otra</p></SiteChrome>);

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
