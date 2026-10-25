import { isArcaConfigured, loadArcaConfig } from '../arca.config';

const files: Record<string, string> = { '/certs/unna.crt': 'CERT PEM', '/certs/unna.key': 'KEY PEM' };
const readFile = (path: string): string => {
  if (!(path in files)) throw new Error(`ENOENT: ${path}`);
  return files[path];
};
const env = (overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  ARCA_ENV: 'homologacion',
  ARCA_CERT_PATH: '/certs/unna.crt',
  ARCA_KEY_PATH: '/certs/unna.key',
  ...overrides,
});

describe('ARCA config', () => {
  it('is configured only when ARCA_ENV, ARCA_CERT_PATH and ARCA_KEY_PATH are all present', () => {
    expect(isArcaConfigured(env())).toBe(true);
    expect(isArcaConfigured({})).toBe(false);
    for (const name of ['ARCA_ENV', 'ARCA_CERT_PATH', 'ARCA_KEY_PATH']) {
      expect(isArcaConfigured(env({ [name]: undefined }))).toBe(false);
      expect(isArcaConfigured(env({ [name]: '  ' }))).toBe(false);
    }
  });

  it('uses the homologation endpoints, reads both PEM files once and defaults the timeout to 15 s', () => {
    const read = jest.fn(readFile);
    expect(loadArcaConfig(env(), read)).toEqual({
      environment: 'homologacion',
      wsaaUrl: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
      wsfeUrl: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
      certificatePem: 'CERT PEM',
      privateKeyPem: 'KEY PEM',
      timeoutMs: 15000,
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('uses the production endpoints and a custom timeout', () => {
    expect(loadArcaConfig(env({ ARCA_ENV: 'produccion', ARCA_TIMEOUT_MS: '8000' }), readFile)).toMatchObject({
      environment: 'produccion',
      wsaaUrl: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
      wsfeUrl: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
      timeoutMs: 8000,
    });
  });

  it('names every missing variable', () => {
    expect(() => loadArcaConfig({ ARCA_ENV: 'homologacion' }, readFile)).toThrow(
      'ARCA no configurado: faltan ARCA_CERT_PATH, ARCA_KEY_PATH',
    );
  });

  it('rejects an unknown environment and an invalid timeout', () => {
    expect(() => loadArcaConfig(env({ ARCA_ENV: 'prod' }), readFile)).toThrow(
      "ARCA_ENV inválido: debe ser 'homologacion' o 'produccion'",
    );
    for (const timeout of ['0', '-5', 'abc', '1.5']) {
      expect(() => loadArcaConfig(env({ ARCA_TIMEOUT_MS: timeout }), readFile)).toThrow(
        'ARCA_TIMEOUT_MS inválido: debe ser un entero positivo de milisegundos',
      );
    }
  });

  it('reports an unreadable PEM file by variable and path, never by content', () => {
    expect(() => loadArcaConfig(env({ ARCA_KEY_PATH: '/certs/missing.key' }), readFile)).toThrow(
      'No se pudo leer ARCA_KEY_PATH (/certs/missing.key)',
    );
  });
});
