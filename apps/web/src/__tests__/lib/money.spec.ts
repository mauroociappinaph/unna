import { centsToInput, parsePesos } from '@/lib/money';
import { apiErrorMessage } from '@/lib/api-errors';

describe('parsePesos', () => {
  it.each([
    ['1500', 150000],
    ['1.500', 150000],
    ['12.345.678', 1234567800],
    ['1500,5', 150050],
    ['1500,50', 150050],
    ['1.500,50', 150050],
    ['1500.5', 150050],
    ['1500.50', 150050],
    ['1.50', 150],
    [' 0 ', 0],
    ['-150', -15000],
    ['-1.500,25', -150025],
  ])('reads %p as %p cents', (text, cents) => {
    expect(parsePesos(text)).toBe(cents);
  });

  it.each(['', 'abc', '1,5,0', '1.5000', '15.00.0', '1500,505', '1.50,00', '--1', '1e3'])('rejects %p', (text) => {
    expect(parsePesos(text)).toBeNull();
  });
});

describe('centsToInput', () => {
  it.each([
    [150000, '1500'],
    [150050, '1500,50'],
    [150005, '1500,05'],
    [-15000, '-150'],
    [0, '0'],
  ])('formats %p cents as %p', (cents, text) => {
    expect(centsToInput(cents)).toBe(text);
  });

  it('round-trips through parsePesos', () => {
    for (const cents of [0, 5, 150000, 150050, -15000, 410400]) expect(parsePesos(centsToInput(cents))).toBe(cents);
  });
});

describe('apiErrorMessage', () => {
  const axiosError = (message: unknown) => ({ response: { data: { message } } });

  it('joins validation messages', () => {
    expect(apiErrorMessage(axiosError(['name must be a string', 'type is invalid']), 'x')).toBe('name must be a string. type is invalid');
  });

  it('returns a string message', () => {
    expect(apiErrorMessage(axiosError('saldo pendiente'), 'x')).toBe('saldo pendiente');
  });

  it('falls back when there is no API message', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'No se pudo guardar')).toBe('No se pudo guardar');
  });
});
