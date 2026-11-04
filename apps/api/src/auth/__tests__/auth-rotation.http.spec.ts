import request from 'supertest';
import { AuthApp, OWNER, startAuthApp, tokenFromLink } from './auth-http-harness';

// S21: single-use refresh tokens over HTTP: rotation, reuse detection and revocation on a password reset.

const SESSION_EXPIRED = 'Sesión vencida. Iniciá sesión de nuevo.';

describe('refresh token rotation (S21)', () => {
  let ctx: AuthApp;
  const http = () => request(ctx.app.getHttpServer());
  const login = async () => (await http().post('/api/v1/auth/login').send({ email: OWNER.email, password: OWNER.password })).body;
  const refresh = (refreshToken: string) => http().post('/api/v1/auth/refresh').send({ refreshToken });
  const jtiOf = (token: string) => ctx.jwt.verifyRefreshToken(token)?.jti ?? '';
  const famOf = (token: string) => ctx.jwt.verifyRefreshToken(token)?.fam ?? '';

  beforeEach(async () => {
    ctx = await startAuthApp();
    await http().post('/api/v1/auth/register').send(OWNER).expect(201);
  });
  afterEach(() => ctx.app.close());

  it('a refresh token works once: the next one works, the spent one answers 401', async () => {
    const session = await login();

    const next = await refresh(session.refreshToken);
    const again = await refresh(session.refreshToken);

    expect(next.status).toBe(200);
    expect(next.body.refreshToken).not.toBe(session.refreshToken);
    expect(again.status).toBe(401);
    expect(again.body).toEqual({ statusCode: 401, message: SESSION_EXPIRED });
    expect((await refresh(next.body.refreshToken)).status).toBe(200);
  });

  it('reusing a spent token after the grace window revokes the family: the newest token answers 401 too', async () => {
    const session = await login();
    const next = (await refresh(session.refreshToken)).body;
    const spent = ctx.sessions.byId.get(jtiOf(session.refreshToken));
    if (spent) spent.usedAt = new Date(Date.now() - 60_000);

    const reuse = await refresh(session.refreshToken);
    const newest = await refresh(next.refreshToken);

    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toBe(SESSION_EXPIRED);
    expect(newest.status).toBe(401);
    expect(newest.body.message).toBe(SESSION_EXPIRED);
    expect(ctx.sessions.family(famOf(session.refreshToken)).every((stored) => stored.revokedAt)).toBe(true);
  });

  it('another login keeps its own family when one family is revoked', async () => {
    const stolen = await login();
    const other = await login();
    const next = (await refresh(stolen.refreshToken)).body;
    const spent = ctx.sessions.byId.get(jtiOf(stolen.refreshToken));
    if (spent) spent.usedAt = new Date(Date.now() - 60_000);

    await refresh(stolen.refreshToken).expect(401);

    expect((await refresh(next.refreshToken)).status).toBe(401);
    expect((await refresh(other.refreshToken)).status).toBe(200);
  });

  it('a password reset revokes every family of the user', async () => {
    const first = await login();
    const second = await login();
    await http().post('/api/v1/auth/forgot-password').send({ email: OWNER.email }).expect(200);
    const token = tokenFromLink(ctx.emails.resetLinks[0]);

    await http().post('/api/v1/auth/reset-password').send({ token, password: 'OtherPass456', confirmPassword: 'OtherPass456' }).expect(200);

    expect([...ctx.sessions.byId.values()].every((stored) => stored.revokedAt)).toBe(true);
    for (const session of [first, second]) {
      const res = await refresh(session.refreshToken);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe(SESSION_EXPIRED);
    }
  });
});
