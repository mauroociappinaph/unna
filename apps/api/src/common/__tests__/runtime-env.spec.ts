import { simulatorsAllowed } from '../runtime-env';

describe('simulatorsAllowed (S16)', () => {
  it.each(['development', 'test', undefined])('allows the simulators when NODE_ENV is %p', (nodeEnv) => {
    expect(simulatorsAllowed({ NODE_ENV: nodeEnv })).toBe(true);
    expect(simulatorsAllowed({ NODE_ENV: nodeEnv, UNNA_ENV: 'prod' })).toBe(true);
  });

  it('refuses them in production without UNNA_ENV', () => {
    expect(simulatorsAllowed({ NODE_ENV: 'production' })).toBe(false);
  });

  it('allows them in production only with UNNA_ENV=staging exactly', () => {
    expect(simulatorsAllowed({ NODE_ENV: 'production', UNNA_ENV: 'staging' })).toBe(true);
  });

  it.each(['Staging', 'STAGING', ' staging', 'staging ', 'prod', 'production', ''])('refuses them in production with UNNA_ENV=%p', (unnaEnv) => {
    expect(simulatorsAllowed({ NODE_ENV: 'production', UNNA_ENV: unnaEnv })).toBe(false);
  });

  it('reads process.env by default', () => {
    const old = { NODE_ENV: process.env.NODE_ENV, UNNA_ENV: process.env.UNNA_ENV };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.UNNA_ENV;
      expect(simulatorsAllowed()).toBe(false);
      process.env.UNNA_ENV = 'staging';
      expect(simulatorsAllowed()).toBe(true);
    } finally {
      process.env.NODE_ENV = old.NODE_ENV;
      if (old.UNNA_ENV === undefined) delete process.env.UNNA_ENV;
      else process.env.UNNA_ENV = old.UNNA_ENV;
    }
  });
});
