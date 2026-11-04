import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BusinessName, Email, Password, PersonName, Phone, User, isErr, isOk } from '@unna/domain';
import { JwtAdapter } from '../../adapters/jwt.adapter';
import { SessionIssuer } from '../../session-issuer';
import { sessionClaims } from '../../session-token';
import { RefreshSessionUseCase } from '../refresh-session.use-case';
import { InMemoryRefreshSessions } from '../../__tests__/in-memory-refresh-sessions';
import { InMemoryUsers, SECRETS } from '../../__tests__/auth-http-harness';

// S21: single-use refresh tokens with rotation, reuse detection and an absolute session lifetime.

const SESSION_EXPIRED = 'Sesión vencida. Iniciá sesión de nuevo.';
const DAY_MS = 24 * 60 * 60 * 1000;

const makeUser = () => User.create(
  'user-1',
  Email.create('owner@unna.test'),
  Password.create('SecurePass123').setHashed('hashed:SecurePass123'),
  PersonName.create('Juan Perez'),
  Phone.create('1112345678'),
  BusinessName.create('Mi Restaurante').value,
);

const setup = async (env: Record<string, string> = {}) => {
  const config = { get: (key: string) => ({ NODE_ENV: 'test', ...SECRETS, ...env } as Record<string, string>)[key] } as ConfigService;
  const jwt = new JwtAdapter(new JwtService(), config);
  const users = new InMemoryUsers();
  const sessions = new InMemoryRefreshSessions();
  const issuer = new SessionIssuer(jwt, sessions, config);
  const user = makeUser();
  await users.save(user);
  const useCase = new RefreshSessionUseCase(users, jwt, sessions, issuer);
  const refresh = (refreshToken: string) => useCase.execute({ refreshToken });
  const claims = (token: string) => jwt.verifyRefreshToken(token);
  return { jwt, users, sessions, issuer, user, refresh, claims, login: () => issuer.start(user) };
};

const rotated = async (result: Awaited<ReturnType<RefreshSessionUseCase['execute']>>) => {
  if (!isOk(result)) throw new Error(`expected a new pair, got ${result.error.message}`);
  return result.value.tokens;
};

const expectExpired = (result: Awaited<ReturnType<RefreshSessionUseCase['execute']>>) => {
  expect(isErr(result) && result.error.message).toBe(SESSION_EXPIRED);
};

describe('RefreshSessionUseCase (S21)', () => {
  it('login starts a family: the refresh token carries its jti and family, and the session is stored', async () => {
    const { sessions, login, claims, user } = await setup();

    const tokens = await login();

    const { jti, fam } = claims(tokens.refreshToken) ?? {};
    expect(jti).toBeTruthy();
    expect(fam).toBe(jti);
    const stored = sessions.byId.get(jti ?? '');
    expect(stored).toMatchObject({ id: jti, userId: user.id, familyId: fam, usedAt: null, revokedAt: null, replacedById: null });
    expect((stored?.expiresAt.getTime() ?? 0) - (stored?.createdAt.getTime() ?? 0)).toBe(30 * DAY_MS);
    expect(Object.keys(new JwtService().decode(tokens.accessToken) as object)).not.toEqual(expect.arrayContaining(['jti']));
  });

  it('rotates: returns a new pair of the same family and spends the presented token', async () => {
    const { sessions, login, refresh, claims } = await setup();
    const first = await login();

    const second = await rotated(await refresh(first.refreshToken));

    const before = claims(first.refreshToken);
    const after = claims(second.refreshToken);
    expect(after?.jti).not.toBe(before?.jti);
    expect(after?.fam).toBe(before?.fam);
    expect(sessions.byId.get(before?.jti ?? '')).toMatchObject({ usedAt: expect.any(Date), replacedById: after?.jti, revokedAt: null });
    expect(sessions.byId.get(after?.jti ?? '')).toMatchObject({ familyId: before?.fam, usedAt: null, revokedAt: null });
    expectExpired(await refresh(first.refreshToken));
    await rotated(await refresh(second.refreshToken));
  });

  it('a reuse after the grace window revokes the whole family: the newest token stops working too', async () => {
    const { sessions, login, refresh, claims } = await setup();
    const first = await login();
    const second = await rotated(await refresh(first.refreshToken));
    const spent = sessions.byId.get(claims(first.refreshToken)?.jti ?? '');
    if (spent) spent.usedAt = new Date(Date.now() - 11_000);

    expectExpired(await refresh(first.refreshToken));

    const family = sessions.family(claims(first.refreshToken)?.fam ?? '');
    expect(family).toHaveLength(2);
    expect(family.every((session) => session.revokedAt instanceof Date)).toBe(true);
    expectExpired(await refresh(second.refreshToken));
    expect(sessions.byId.size).toBe(2);
  });

  it('a reuse within 10 s of the rotation (two tabs racing) answers 401 without revoking the family', async () => {
    const { sessions, login, refresh, claims } = await setup();
    const first = await login();
    const second = await rotated(await refresh(first.refreshToken));

    expectExpired(await refresh(first.refreshToken));

    expect(sessions.family(claims(first.refreshToken)?.fam ?? '').every((session) => session.revokedAt === null)).toBe(true);
    await rotated(await refresh(second.refreshToken));
  });

  it('two concurrent refreshes with the same token: one rotates, the other gets 401 and the family survives', async () => {
    const { sessions, login, refresh, claims } = await setup();
    const first = await login();

    const results = await Promise.all([refresh(first.refreshToken), refresh(first.refreshToken)]);

    expect(results.filter(isOk)).toHaveLength(1);
    expect(results.filter(isErr)).toHaveLength(1);
    expect(sessions.family(claims(first.refreshToken)?.fam ?? '').every((session) => session.revokedAt === null)).toBe(true);
  });

  it.each([
    ['the default 30 days', {}, 31 * DAY_MS],
    ['SESSION_MAX_DAYS=2', { SESSION_MAX_DAYS: '2' }, 3 * DAY_MS],
  ])('refuses to refresh a family older than %s, writing nothing', async (_name, env, age) => {
    const { sessions, login, refresh, claims } = await setup(env);
    const tokens = await login();
    const head = sessions.byId.get(claims(tokens.refreshToken)?.jti ?? '');
    if (head) {
      head.createdAt = new Date(Date.now() - age);
      head.expiresAt = new Date(Date.now() + DAY_MS);
    }

    expectExpired(await refresh(tokens.refreshToken));

    expect(sessions.byId.size).toBe(1);
    expect(head?.usedAt).toBeNull();
  });

  it('still refreshes a family younger than SESSION_MAX_DAYS, and caps the session at the family deadline', async () => {
    const { sessions, login, refresh, claims } = await setup({ SESSION_MAX_DAYS: '2' });
    const tokens = await login();
    const head = sessions.byId.get(claims(tokens.refreshToken)?.jti ?? '');
    if (head) head.createdAt = new Date(Date.now() - DAY_MS);

    const next = await rotated(await refresh(tokens.refreshToken));

    expect(sessions.byId.get(claims(next.refreshToken)?.jti ?? '')?.expiresAt).toEqual(head?.expiresAt);
  });

  it('refuses a session past its stored expiry', async () => {
    const { sessions, login, refresh, claims } = await setup();
    const tokens = await login();
    const head = sessions.byId.get(claims(tokens.refreshToken)?.jti ?? '');
    if (head) head.expiresAt = new Date(Date.now() - 1000);

    expectExpired(await refresh(tokens.refreshToken));
    expect(head?.usedAt).toBeNull();
  });

  it('refuses a revoked family (password reset) and a token whose session is not stored', async () => {
    const { sessions, login, refresh, user, claims } = await setup();
    const tokens = await login();
    await sessions.revokeAllOfUser(user.id, new Date());

    expectExpired(await refresh(tokens.refreshToken));

    sessions.byId.delete(claims(tokens.refreshToken)?.jti ?? '');
    expectExpired(await refresh(tokens.refreshToken));
  });

  it('refuses a refresh token issued before S21 (no jti or family), once', async () => {
    const { jwt, refresh, user } = await setup();
    const legacy = jwt.generateRefreshToken(sessionClaims(user));

    expectExpired(await refresh(legacy));
  });

  it('refuses a session stored for another user', async () => {
    const { sessions, login, refresh, claims } = await setup();
    const tokens = await login();
    const head = sessions.byId.get(claims(tokens.refreshToken)?.jti ?? '');
    if (head) head.userId = 'someone-else';

    expectExpired(await refresh(tokens.refreshToken));
    expect(head?.usedAt).toBeNull();
  });

  it('keeps the password fingerprint check: a changed password ends the session', async () => {
    const { login, refresh, user } = await setup();
    const tokens = await login();
    user.changePassword(Password.create('OtherPass456').setHashed('hashed:OtherPass456'));

    expectExpired(await refresh(tokens.refreshToken));
  });

  it('refuses to start with an invalid SESSION_MAX_DAYS', async () => {
    await expect(setup({ SESSION_MAX_DAYS: 'treinta' })).rejects.toThrow('SESSION_MAX_DAYS tiene que ser un número de días mayor a 0');
  });
});
