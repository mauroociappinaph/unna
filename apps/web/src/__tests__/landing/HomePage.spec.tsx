import { render, screen, within } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage (landing for take-away cafés)', () => {
  it('positions the hero for take-away cafés', () => {
    render(<HomePage />);

    const hero = screen.getByRole('heading', { level: 1 });
    expect(hero).toHaveTextContent(/café/i);
    expect(hero).toHaveTextContent(/take away/i);
  });

  it('shows the brand tagline and supporting line verbatim', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('El sistema para cafés take away.');
    expect(
      screen.getByText('Vendé rápido en el mostrador, cobrá fácil y controlá tus cobros y tu stock.'),
    ).toBeInTheDocument();
  });

  it('keeps the community tagline without metrics', () => {
    render(<HomePage />);

    expect(screen.getAllByText(/A Community of Sharing/).length).toBeGreaterThan(0);
  });

  it('does not render claims UNNA cannot back', () => {
    const { container } = render(<HomePage />);

    expect(container.textContent).not.toMatch(/35\.000|350M|#1 Plataforma|Terminal UNNA|restaurante/i);
  });

  it('lists the available features under "Disponible hoy"', () => {
    render(<HomePage />);

    const available = screen.getByRole('region', { name: 'Disponible hoy' });
    expect(within(available).getByText(/opciones de cada café/i)).toBeInTheDocument();
    expect(within(available).getByText(/modificadores/i)).toBeInTheDocument();
    expect(within(available).getByText(/pagos divididos/i)).toBeInTheDocument();
    expect(within(available).queryByText(/Próximamente/)).not.toBeInTheDocument();
  });

  it.each([/ARCA/, /caja y turnos/i, /pedido anticipado/i, /tarjeta de sellos/i])(
    'labels the planned feature %s as "Próximamente"',
    (feature) => {
      render(<HomePage />);

      const upcoming = screen.getByRole('region', { name: 'Próximamente' });
      const item = within(upcoming).getByText(feature).closest('li');
      expect(item).not.toBeNull();
      expect(within(item as HTMLElement).getByText('Próximamente')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Disponible hoy' })).queryByText(feature)).not.toBeInTheDocument();
    },
  );

  it('lists business types for the café segment', () => {
    render(<HomePage />);

    const types = screen.getByRole('region', { name: /tipo de café/i });
    for (const name of [
      'Cafés take away',
      'Cafés de especialidad',
      'Cafeterías con pocas mesas',
      'Panaderías y pastelerías con café',
      'Carritos y kioscos de café',
      'Cadenas de cafés',
    ]) {
      expect(within(types).getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('sends the main CTAs to account creation and features', () => {
    render(<HomePage />);

    const tryLinks = screen.getAllByRole('link', { name: 'Probar gratis' });
    expect(tryLinks.length).toBeGreaterThan(0);
    for (const link of tryLinks) expect(link).toHaveAttribute('href', '/crear-cuenta');
    expect(screen.getByRole('link', { name: 'Ver funcionalidades' })).toHaveAttribute('href', '#funcionalidades');
  });

  it('does not reference missing images', () => {
    const { container } = render(<HomePage />);

    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('src') ?? '').not.toMatch(/\/images\//);
    }
    expect(container.innerHTML).not.toMatch(/\/images\/|\/assets\/patterns\//);
  });
});
