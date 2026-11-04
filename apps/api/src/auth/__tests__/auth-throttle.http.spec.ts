import request from 'supertest';
import { authThrottlerOptions } from '../auth-throttle';
import { AuthApp, OWNER, startAuthApp } from './auth-http-harness';

// S21: per-IP attempt limits on the auth routes that take a secret or send a mail.

const TOO_MANY = 'Demasiados intentos. Esperá un minuto y volvé a probar.';

describe('auth rate limit (S21)', () => {
  describe('authThrottlerOptions', () => {
    it('allows 10 login/refresh and 5 recovery attempts per minute by default', () => {
      expect(authThrottlerOptions({})).toEqual([
        { name: 'auth', ttl: 60_000, limit: 10 },
        { name: 'auth-recovery', ttl: 60_000, limit: 5 },
      ]);
    });

    it('reads the limit from AUTH_RATE_LIMIT; recovery gets half of it, at least 1', () => {
      expect(authThrottlerOptions({ AUTH_RATE_LIMIT: '20' }).map((o) => o.limit)).toEqual([20, 10]);
      expect(authThrottlerOptions({ AUTH_RATE_LIMIT: '1' }).map((o) => o.limit)).toEqual([1, 1]);
    });

    it.each(['0', '-5', 'abc'])('ignores an invalid AUTH_RATE_LIMIT %p', (value) => {
      expect(authThrottlerOptions({ AUTH_RATE_LIMIT: value }).map((o) => o.limit)).toEqual([10, 5]);
    });
  });

  describe('HTTP', () => {
    let ctx: AuthApp;
    const http = () => request(ctx.app.getHttpServer());

    beforeEach(async () => {
      ctx = await startAuthApp();
    });
    afterEach(() => ctx.app.close());

    const hammer = async (count: number, send: () => request.Test): Promise<number[]> => {
      const statuses: number[] = [];
      for (let i = 0; i < count; i += 1) statuses.push((await send()).status);
      return statuses;
    };

    it('answers 429 in Spanish on the 11th login of a minute, without counting other routes', async () => {
      await http().post('/api/v1/auth/register').send(OWNER).expect(201);
      const wrong = () => http().post('/api/v1/auth/login').send({ email: OWNER.email, password: 'WrongPass000' });

      expect(await hammer(10, wrong)).toEqual(Array(10).fill(401));
      const blocked = await http().post('/api/v1/auth/login').send({ email: OWNER.email, password: OWNER.password });

      expect(blocked.status).toBe(429);
      expect(blocked.body.message).toBe(TOO_MANY);
      expect((await http().post('/api/v1/auth/refresh').send({ refreshToken: 'x' })).status).toBe(401);
      expect((await http().post('/api/v1/auth/forgot-password').send({ email: OWNER.email })).status).toBe(200);
    });

    it('limits refresh to 10 a minute', async () => {
      const send = () => http().post('/api/v1/auth/refresh').send({ refreshToken: 'x' });

      expect(await hammer(10, send)).toEqual(Array(10).fill(401));
      expect((await send()).status).toBe(429);
    });

    it.each([
      ['forgot-password', { email: OWNER.email }, 200],
      ['reset-password', { token: 'x', password: 'OtherPass456', confirmPassword: 'OtherPass456' }, 400],
    ])('limits %s to 5 a minute', async (route, body, status) => {
      const send = () => http().post(`/api/v1/auth/${route}`).send(body);

      expect(await hammer(5, send)).toEqual(Array(5).fill(status));
      const blocked = await send();
      expect(blocked.status).toBe(429);
      expect(blocked.body.message).toBe(TOO_MANY);
    });

    it('does not limit register or verify-email', async () => {
      const statuses = await hammer(12, () => http().post('/api/v1/auth/verify-email').send({ token: 'x' }));

      expect(statuses).toEqual(Array(12).fill(400));
      for (let i = 0; i < 11; i += 1) {
        await http().post('/api/v1/auth/register').send({ ...OWNER, email: `owner${i}@unna.test` }).expect(201);
      }
    });
  });
});
