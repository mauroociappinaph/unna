import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import tailwindConfig from '../../../tailwind.config';

// WCAG 2.1 AA: normal-size text needs a contrast ratio of at least 4.5:1.
const AA_TEXT = 4.5;
const WHITE = '#ffffff';

const palette = (tailwindConfig.theme?.extend?.colors as Record<string, Record<string, string>>).unna;

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Resolves the resting (non-hover) `${prefix}-unna-*` class of an element to its hex color. */
const unnaColor = (element: HTMLElement, prefix: 'bg' | 'text') => {
  const token = element.className
    .split(/\s+/)
    .find((c) => c.startsWith(`${prefix}-unna-`))
    ?.slice(`${prefix}-unna-`.length);
  if (!token || !palette[token]) throw new Error(`no ${prefix}-unna-* color on: ${element.className}`);
  return palette[token];
};

describe('Button color contrast', () => {
  it('primary: white text on its background meets WCAG AA', () => {
    render(<Button>Guardar</Button>);
    const button = screen.getByRole('button', { name: 'Guardar' });

    expect(button.className).toContain('text-white');
    expect(contrast(WHITE, unnaColor(button, 'bg'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('secondary: green text on white meets WCAG AA', () => {
    render(<Button variant="secondary">Cancelar</Button>);
    const button = screen.getByRole('button', { name: 'Cancelar' });

    expect(button.className).toContain('bg-white');
    expect(contrast(unnaColor(button, 'text'), WHITE)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
