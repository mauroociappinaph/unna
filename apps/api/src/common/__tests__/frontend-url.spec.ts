import { frontendUrl } from '../frontend-url';

describe('frontendUrl', () => {
  it('returns FRONTEND_URL without trailing slashes or spaces', () => {
    expect(frontendUrl({ FRONTEND_URL: 'https://app.unna.test' })).toBe('https://app.unna.test');
    expect(frontendUrl({ FRONTEND_URL: ' https://app.unna.test// ', NODE_ENV: 'production' })).toBe('https://app.unna.test');
  });

  it.each(['development', 'test', undefined])('defaults to the local web app when it is missing and NODE_ENV is %p', (nodeEnv) => {
    expect(frontendUrl({ NODE_ENV: nodeEnv })).toBe('http://localhost:3000');
    expect(frontendUrl({ NODE_ENV: nodeEnv, FRONTEND_URL: '  ' })).toBe('http://localhost:3000');
  });

  it.each([{}, { UNNA_ENV: 'staging' }, { FRONTEND_URL: '' }, { FRONTEND_URL: ' / ' }])('refuses a missing FRONTEND_URL in production (%p)', (env) => {
    expect(() => frontendUrl({ NODE_ENV: 'production', ...env })).toThrow(
      'Falta FRONTEND_URL: en producción es obligatoria la URL de la web (por ejemplo https://unna-web.onrender.com)',
    );
  });

  it('reads process.env by default', () => {
    const old = process.env.FRONTEND_URL;
    try {
      process.env.FRONTEND_URL = 'https://env.unna.test/';
      expect(frontendUrl()).toBe('https://env.unna.test');
    } finally {
      if (old === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = old;
    }
  });
});
