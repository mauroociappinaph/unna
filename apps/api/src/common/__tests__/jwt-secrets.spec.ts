import { jwtSecrets } from '../jwt-secrets';

const ACCESS = 'a'.repeat(32);
const REFRESH = 'r'.repeat(32);
const RESET = 's'.repeat(32);
const PROD = { NODE_ENV: 'production', JWT_SECRET: ACCESS, JWT_REFRESH_SECRET: REFRESH, JWT_RESET_SECRET: RESET };

describe('jwtSecrets (S21)', () => {
  it('returns one secret per token type', () => {
    expect(jwtSecrets(PROD)).toEqual({ access: ACCESS, refresh: REFRESH, reset: RESET });
  });

  it.each(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_RESET_SECRET'])('refuses a missing %s in production', (key) => {
    const message = `Falta ${key}: en producción cada tipo de token necesita su propio secreto de al menos 32 caracteres (generalo con openssl rand -base64 48)`;
    expect(() => jwtSecrets({ ...PROD, [key]: undefined })).toThrow(message);
    expect(() => jwtSecrets({ ...PROD, [key]: '' })).toThrow(message);
  });

  it.each(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_RESET_SECRET'])('refuses a %s shorter than 32 characters in production', (key) => {
    expect(() => jwtSecrets({ ...PROD, [key]: 'x'.repeat(31) })).toThrow(
      `${key} es demasiado corto: en producción tiene que tener al menos 32 caracteres (generalo con openssl rand -base64 48)`,
    );
  });

  it.each([
    [{ JWT_REFRESH_SECRET: ACCESS }, 'JWT_SECRET y JWT_REFRESH_SECRET'],
    [{ JWT_RESET_SECRET: ACCESS }, 'JWT_SECRET y JWT_RESET_SECRET'],
    [{ JWT_RESET_SECRET: REFRESH }, 'JWT_REFRESH_SECRET y JWT_RESET_SECRET'],
  ])('refuses two equal secrets in production (%p)', (override, pair) => {
    expect(() => jwtSecrets({ ...PROD, ...override })).toThrow(`${pair} no pueden ser iguales: cada tipo de token necesita su propio secreto`);
  });

  it('outside production derives distinct refresh and reset secrets from JWT_SECRET when they are missing', () => {
    const secrets = jwtSecrets({ NODE_ENV: 'development', JWT_SECRET: 'dev' });

    expect(secrets.access).toBe('dev');
    expect(new Set([secrets.access, secrets.refresh, secrets.reset]).size).toBe(3);
    expect(jwtSecrets({ NODE_ENV: 'test', JWT_SECRET: 'dev', JWT_REFRESH_SECRET: 'r', JWT_RESET_SECRET: 's' })).toEqual({ access: 'dev', refresh: 'r', reset: 's' });
  });

  it.each(['development', 'test', undefined])('always needs JWT_SECRET (NODE_ENV %p)', (nodeEnv) => {
    expect(() => jwtSecrets({ NODE_ENV: nodeEnv })).toThrow('Falta JWT_SECRET: la API no puede firmar sesiones sin él');
  });
});
