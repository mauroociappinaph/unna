import { render, screen } from '@testing-library/react';
import { SiteChrome } from '@/components/layout/SiteChrome';
import tailwindConfig from '../../../tailwind.config';

let pathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn() }),
}));

const palette = (tailwindConfig.theme?.extend?.colors as Record<string, Record<string, string>>).unna;

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastWithWhite = (hex: string) => (luminance('#ffffff') + 0.05) / (luminance(hex) + 0.05);

describe('"Ambiente de prueba" banner (S16)', () => {
  const OLD = process.env.NEXT_PUBLIC_UNNA_ENV;
  afterEach(() => {
    if (OLD === undefined) delete process.env.NEXT_PUBLIC_UNNA_ENV;
    else process.env.NEXT_PUBLIC_UNNA_ENV = OLD;
  });

  it.each(['/', '/login', '/dashboard', '/dashboard/pos'])('is shown on %s with NEXT_PUBLIC_UNNA_ENV=staging', (path) => {
    process.env.NEXT_PUBLIC_UNNA_ENV = 'staging';
    pathname = path;
    render(<SiteChrome><p>contenido</p></SiteChrome>);

    expect(screen.getByText('Ambiente de prueba')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('uses white text on the text-bearing brand green, with AA contrast, and never blocks clicks', () => {
    process.env.NEXT_PUBLIC_UNNA_ENV = 'staging';
    pathname = '/';
    render(<SiteChrome><p>contenido</p></SiteChrome>);
    const banner = screen.getByText('Ambiente de prueba');

    expect(banner.className).toContain('bg-unna-green-dark');
    expect(banner.className).toContain('text-white');
    expect(banner.className).toContain('pointer-events-none');
    expect(contrastWithWhite(palette['green-dark'])).toBeGreaterThanOrEqual(4.5);
  });

  it('is not shown on the public order screen, so it never covers the board', () => {
    process.env.NEXT_PUBLIC_UNNA_ENV = 'staging';
    pathname = '/pantalla/some-token';
    render(<SiteChrome><p>pedidos</p></SiteChrome>);

    expect(screen.queryByText('Ambiente de prueba')).not.toBeInTheDocument();
    expect(screen.getByText('pedidos')).toBeInTheDocument();
  });

  it.each([undefined, '', 'production', 'Staging', 'prod'])('is not shown with NEXT_PUBLIC_UNNA_ENV=%p', (value) => {
    if (value === undefined) delete process.env.NEXT_PUBLIC_UNNA_ENV;
    else process.env.NEXT_PUBLIC_UNNA_ENV = value;
    pathname = '/';
    render(<SiteChrome><p>contenido</p></SiteChrome>);

    expect(screen.queryByText('Ambiente de prueba')).not.toBeInTheDocument();
  });

  it('keeps the site header as the only banner landmark', () => {
    process.env.NEXT_PUBLIC_UNNA_ENV = 'staging';
    pathname = '/';
    render(<SiteChrome><p>contenido</p></SiteChrome>);

    expect(screen.getAllByRole('banner')).toHaveLength(1);
  });
});
