import { fiscalAuthorizerFactory } from '../business.module';
import { ArcaSimulatedAdapter } from '../adapters/arca-simulated.adapter';

describe('fiscalAuthorizerFactory', () => {
  it('refuses the ARCA simulator in production, so no receipt gets a made-up CAE', () => {
    expect(() => fiscalAuthorizerFactory({ NODE_ENV: 'production' })).toThrow(
      'ARCA real no configurado: el simulador de ARCA no puede usarse en producción',
    );
  });

  it.each(['development', 'test', undefined])('uses the simulator when NODE_ENV is %p', (nodeEnv) => {
    expect(fiscalAuthorizerFactory({ NODE_ENV: nodeEnv })).toBeInstanceOf(ArcaSimulatedAdapter);
  });
});
