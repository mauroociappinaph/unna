import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

// Pages that exist in the app router, and the section ids of the landing (S19).
const PAGES = ['/', '/login', '/crear-cuenta'];
const landing = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf8');
const LANDING_SECTIONS = [...landing.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);

describe('Footer (S19)', () => {
  it('only links to pages and landing sections that exist', () => {
    render(<Footer />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const [path, hash] = href.split('#');
      expect(PAGES).toContain(path || '/');
      if (hash) expect(LANDING_SECTIONS).toContain(hash);
    }
  });

  it('links to no external profile that UNNA does not own', () => {
    render(<Footer />);

    const external = screen.getAllByRole('link').filter((link) => /^https?:/.test(link.getAttribute('href') ?? ''));
    expect(external).toHaveLength(0);
  });
});
