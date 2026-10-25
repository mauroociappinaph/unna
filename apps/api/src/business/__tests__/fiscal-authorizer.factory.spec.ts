import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fiscalAuthorizerFactory } from '../business.module';
import { ArcaSimulatedAdapter } from '../adapters/arca-simulated.adapter';
import { ArcaFiscalAuthorizerAdapter } from '../adapters/arca/arca-fiscal-authorizer.adapter';
import { throwawayCredentials } from '../adapters/arca/__tests__/arca-test-support';

describe('fiscalAuthorizerFactory', () => {
  it('refuses the ARCA simulator in production, so no receipt gets a made-up CAE', () => {
    expect(() => fiscalAuthorizerFactory({ NODE_ENV: 'production' })).toThrow(
      'ARCA real no configurado: el simulador de ARCA no puede usarse en producción',
    );
  });

  it.each(['development', 'test', undefined])('uses the simulator when NODE_ENV is %p and ARCA is not configured', (nodeEnv) => {
    expect(fiscalAuthorizerFactory({ NODE_ENV: nodeEnv })).toBeInstanceOf(ArcaSimulatedAdapter);
  });

  describe('with ARCA configured', () => {
    let dir: string;
    let env: NodeJS.ProcessEnv;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'unna-arca-'));
      const { certificatePem, privateKeyPem } = throwawayCredentials();
      writeFileSync(join(dir, 'cert.pem'), certificatePem);
      writeFileSync(join(dir, 'key.pem'), privateKeyPem);
      env = { ARCA_ENV: 'homologacion', ARCA_CERT_PATH: join(dir, 'cert.pem'), ARCA_KEY_PATH: join(dir, 'key.pem') };
    });

    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it.each(['production', 'development'])('uses the real ARCA adapter when NODE_ENV is %p', (nodeEnv) => {
      expect(fiscalAuthorizerFactory({ ...env, NODE_ENV: nodeEnv })).toBeInstanceOf(ArcaFiscalAuthorizerAdapter);
    });
  });
});
