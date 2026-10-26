import { mercadoPagoGatewayFactory } from '../business.module';
import { MercadoPagoSimulatorAdapter } from '../adapters/mercadopago/mercadopago-simulator.adapter';
import { MercadoPagoHttpAdapter } from '../adapters/mercadopago/mercadopago-http.adapter';

const credentials = { MP_CLIENT_ID: '123', MP_CLIENT_SECRET: 'app-secret', MP_REDIRECT_URI: 'https://api.example.com/api/v1/mercadopago/oauth/callback' };

describe('mercadoPagoGatewayFactory (S15)', () => {
  it('refuses the simulator in production', () => {
    expect(() => mercadoPagoGatewayFactory({ NODE_ENV: 'production' })).toThrow(
      'Mercado Pago no configurado: el simulador de Mercado Pago no puede usarse en producción',
    );
    expect(() => mercadoPagoGatewayFactory({ NODE_ENV: 'production', MP_CLIENT_ID: '123' })).toThrow(
      'Mercado Pago no configurado: el simulador de Mercado Pago no puede usarse en producción',
    );
  });

  it.each(['Staging', 'prod', ''])('still refuses the simulator in production with UNNA_ENV=%p (S16)', (unnaEnv) => {
    expect(() => mercadoPagoGatewayFactory({ NODE_ENV: 'production', UNNA_ENV: unnaEnv })).toThrow(
      'Mercado Pago no configurado: el simulador de Mercado Pago no puede usarse en producción',
    );
  });

  it('uses the simulator in production with UNNA_ENV=staging and no credentials (S16)', () => {
    expect(mercadoPagoGatewayFactory({ NODE_ENV: 'production', UNNA_ENV: 'staging' })).toBeInstanceOf(MercadoPagoSimulatorAdapter);
  });

  it('keeps the real adapter in staging when the credentials are set (S16)', () => {
    expect(mercadoPagoGatewayFactory({ ...credentials, NODE_ENV: 'production', UNNA_ENV: 'staging' })).toBeInstanceOf(MercadoPagoHttpAdapter);
  });

  it.each(['development', 'test', undefined])('uses the simulator when NODE_ENV is %p and there are no credentials', (nodeEnv) => {
    expect(mercadoPagoGatewayFactory({ NODE_ENV: nodeEnv })).toBeInstanceOf(MercadoPagoSimulatorAdapter);
    expect(mercadoPagoGatewayFactory({ NODE_ENV: nodeEnv, MP_CLIENT_ID: '123', MP_CLIENT_SECRET: '  ' })).toBeInstanceOf(MercadoPagoSimulatorAdapter);
  });

  it.each(['production', 'development'])('uses the real adapter with MP_CLIENT_ID and MP_CLIENT_SECRET when NODE_ENV is %p', (nodeEnv) => {
    expect(mercadoPagoGatewayFactory({ ...credentials, NODE_ENV: nodeEnv })).toBeInstanceOf(MercadoPagoHttpAdapter);
  });

  it('requires MP_REDIRECT_URI for the real adapter, without echoing the secret', () => {
    const run = () => mercadoPagoGatewayFactory({ MP_CLIENT_ID: '123', MP_CLIENT_SECRET: 'app-secret' });
    expect(run).toThrow('Mercado Pago no configurado: falta MP_REDIRECT_URI');
    expect(run).not.toThrow(/app-secret/);
  });
});
