import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthApp, OWNER, SECRETS, startAuthApp, tokenFromLink } from './auth-http-harness';

// S21: session renewal, typed tokens, single-use reset links and closing sessions on a password change.

const SESSION_EXPIRED = 'Sesión vencida. Iniciá sesión de nuevo.';
const LINK_USED = 'El link ya se usó o venció. Pedí uno nuevo.';
const NEW_PASSWORD = { password: 'OtherPass456', confirmPassword: 'OtherPass456' };

describe('auth sessions (S21)', () => {
  let ctx: AuthApp;
  const http = () => request(ctx.app.getHttpServer());
  const login = async () => (await http().post('/api/v1/auth/login').send({ email: OWNER.email, password: OWNER.password })).body;
  const resetLink = async () => {
    await http().post('/api/v1/auth/forgot-password').send({ email: OWNER.email }).expect(200);
    return tokenFromLink(ctx.emails.resetLinks[ctx.emails.resetLinks.length - 1]);
  };

  beforeEach(async () => {
    ctx = await startAuthApp();
    await http().post('/api/v1/auth/register').send(OWNER).expect(201);
  });
  afterEach(() => ctx.app.close());

  describe('POST /auth/refresh', () => {
    it('answers a fresh pair with the same shape as login, and the new access token works', async () => {
      const session = await login();

      const res = await http().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['accessToken', 'expiresIn', 'refreshToken', 'user']);
      expect(res.body.user).toEqual({ id: session.user.id, email: OWNER.email, name: OWNER.name, businessName: OWNER.businessName });
      expect(res.body.expiresIn).toBeGreaterThan(0);
      const me = await http().get('/api/v1/me').set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(me.status).toBe(200);
      expect(me.body.sub).toBe(session.user.id);
      expect((await http().post('/api/v1/auth/refresh').send({ refreshToken: res.body.refreshToken })).status).toBe(200);
    });

    it.each([
      ['a malformed token', () => 'not-a-jwt'],
      ['an access token', (s: { accessToken: string }) => s.accessToken],
      ['a token signed with another secret', () => new JwtService().sign({ sub: 'x', email: OWNER.email, type: 'refresh' }, { secret: 'foreign-secret-0123456789abcdef0123' })],
    ])('rejects %s with 401 and the Spanish message', async (_name, pick) => {
      const session = await login();

      const res = await http().post('/api/v1/auth/refresh').send({ refreshToken: pick(session) });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(SESSION_EXPIRED);
    });

    it('rejects an expired refresh token', async () => {
      const session = await login();
      const claims = new JwtService().decode(session.refreshToken) as Record<string, unknown>;
      const expired = new JwtService().sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }, { secret: SECRETS.JWT_REFRESH_SECRET });

      const res = await http().post('/api/v1/auth/refresh').send({ refreshToken: expired });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(SESSION_EXPIRED);
    });

    it('rejects the refresh token of a deactivated or deleted user', async () => {
      const session = await login();
      ctx.users.byId.get(session.user.id)?.deactivate();

      const res = await http().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(SESSION_EXPIRED);
      ctx.users.byId.clear();
      expect((await http().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken })).status).toBe(401);
    });
  });

  describe('login errors', () => {
    it('answer a JSON message the web can show, and reveal a deactivated account only with its password', async () => {
      const session = await login();
      ctx.users.byId.get(session.user.id)?.deactivate();
      const send = (email: string, password: string) => http().post('/api/v1/auth/login').send({ email, password });

      for (const res of [await send(OWNER.email, 'WrongPass000'), await send('nobody@unna.test', OWNER.password)]) {
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ statusCode: 401, message: 'Credenciales inválidas' });
      }
      const right = await send(OWNER.email, OWNER.password);
      expect(right.status).toBe(401);
      expect(right.body.message).toBe('Cuenta desactivada');
    });
  });

  describe('access tokens', () => {
    it('reject a password reset token and a refresh token as bearer', async () => {
      const session = await login();
      const reset = await resetLink();

      for (const token of [reset, session.refreshToken]) {
        const res = await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
      }
    });

    it('reject a reset token even when it is signed with the access secret (no JWT_RESET_SECRET outside production)', async () => {
      await ctx.app.close();
      ctx = await startAuthApp({ NODE_ENV: 'development', JWT_SECRET: SECRETS.JWT_SECRET });
      await http().post('/api/v1/auth/register').send(OWNER).expect(201);
      const session = await login();
      const forged = new JwtService().sign({ sub: session.user.id, email: OWNER.email, type: 'password_reset' }, { secret: SECRETS.JWT_SECRET });

      expect((await http().get('/api/v1/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
      expect((await http().get('/api/v1/me').set('Authorization', `Bearer ${session.accessToken}`)).status).toBe(200);
    });
  });

  describe('JWT secrets at startup', () => {
    const PROD = { NODE_ENV: 'production', FRONTEND_URL: 'https://web.unna.test', ...SECRETS };

    it.each([
      [{ JWT_RESET_SECRET: undefined }, 'Falta JWT_RESET_SECRET'],
      [{ JWT_REFRESH_SECRET: SECRETS.JWT_SECRET }, 'JWT_SECRET y JWT_REFRESH_SECRET no pueden ser iguales'],
      [{ JWT_SECRET: 'short' }, 'JWT_SECRET es demasiado corto'],
    ])('the auth module refuses to start in production with %p', async (override, message) => {
      await expect(startAuthApp({ ...PROD, ...override })).rejects.toThrow(message);
    });

    it('starts in production with three distinct long secrets', async () => {
      const prod = await startAuthApp(PROD);
      await prod.app.close();
    });
  });

  describe('password reset', () => {
    it('accepts a reset link once; the same link fails afterwards', async () => {
      const token = await resetLink();

      await http().post('/api/v1/auth/reset-password').send({ token, ...NEW_PASSWORD }).expect(200);
      const again = await http().post('/api/v1/auth/reset-password').send({ token, password: 'ThirdPass789', confirmPassword: 'ThirdPass789' });

      expect(again.status).toBe(400);
      expect(again.body.message).toBe(LINK_USED);
      expect((await http().post('/api/v1/auth/login').send({ email: OWNER.email, password: NEW_PASSWORD.password })).status).toBe(200);
    });

    it('closes every open session: old access and refresh tokens stop working', async () => {
      const session = await login();
      const token = await resetLink();

      await http().post('/api/v1/auth/reset-password').send({ token, ...NEW_PASSWORD }).expect(200);

      expect((await http().get('/api/v1/me').set('Authorization', `Bearer ${session.accessToken}`)).status).toBe(401);
      const refresh = await http().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
      expect(refresh.status).toBe(401);
      expect(refresh.body.message).toBe(SESSION_EXPIRED);
    });

    it('also invalidates older reset links once the password changed', async () => {
      const first = await resetLink();
      const second = await resetLink();

      await http().post('/api/v1/auth/reset-password').send({ token: second, ...NEW_PASSWORD }).expect(200);
      const res = await http().post('/api/v1/auth/reset-password').send({ token: first, password: 'ThirdPass789', confirmPassword: 'ThirdPass789' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(LINK_USED);
    });
  });
});
