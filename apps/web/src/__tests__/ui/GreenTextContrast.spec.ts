import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// #16a34a (unna-green) with white text is about 3.3 to 1, below the WCAG AA minimum of 4.5 to 1 for normal text; the brand
// manual reserves it for icons and borders. Text on green uses unna-green-dark (#15803d, about 5 to 1) (S19).
const SRC = join(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx|ts)$/.test(name) ? [path] : [];
  });
}

describe('text on the brand green (S19)', () => {
  it('never puts white text on unna-green (#16a34a)', () => {
    const offenders = sourceFiles(SRC).flatMap((file) => {
      const classStrings = readFileSync(file, 'utf8').match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? [];
      return classStrings
        .filter((value) => /(^|[\s'"`])bg-unna-green(?=[\s'"`])/.test(value) && /\btext-white\b/.test(value))
        .map((value) => `${relative(SRC, file)}: ${value}`);
    });

    expect(offenders).toEqual([]);
  });
});
