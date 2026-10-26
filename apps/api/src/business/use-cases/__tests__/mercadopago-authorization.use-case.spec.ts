import { createHash } from 'crypto';
import { MercadoPagoAuthorizationUseCase } from '../mercadopago-authorization.use-case';
import { BUSINESS, DAY_MS, fakeGateway, InMemoryMercadoPagoRepository, NOW, OWNER, testCipher } from './mercadopago-fakes';

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');
const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

const setup = () => {
  const repo = new InMemoryMercadoPagoRepository();
  const gateway = fakeGateway();
  const cipher = testCipher();
  return { repo, gateway, cipher, useCase: new MercadoPagoAuthorizationUseCase(repo, gateway, cipher) };
};

/** Starts an attempt and returns the state the gateway put in the authorization URL. */
const start = async (ctx: ReturnType<typeof setup>, now = NOW) => {
  const result = await ctx.useCase.connect(BUSINESS, OWNER, now);
  expect(result.ok).toBe(true);
  const { state, codeChallenge } = ctx.gateway.buildAuthorizationUrl.mock.calls.at(-1)![0];
  return { state, codeChallenge, authorizationUrl: result.value!.authorizationUrl };
};

describe('MercadoPagoAuthorizationUseCase (S15)', () => {
  describe('connect', () => {
    it('returns the authorization URL with a random state and an S256 PKCE challenge', async () => {
      const ctx = setup();
      const first = await start(ctx);
      const second = await start(ctx);
      expect(first.authorizationUrl).toContain(`state=${first.state}`);
      expect(first.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(first.state).not.toBe(second.state);
      expect(first.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const attempt = ctx.repo.attempts.get(sha256Hex(first.state))!;
      const verifier = ctx.cipher.decrypt(attempt.encryptedCodeVerifier);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
      expect(s256(verifier)).toBe(first.codeChallenge);
    });

    it('stores only the state hash and the encrypted verifier, bound to business and owner, for 10 minutes', async () => {
      const ctx = setup();
      const { state } = await start(ctx);
      const [[hash, attempt]] = [...ctx.repo.attempts];
      expect(hash).toBe(sha256Hex(state));
      expect(JSON.stringify(attempt)).not.toContain(state);
      expect(attempt).toMatchObject({ businessId: BUSINESS, ownerId: OWNER, expiresAt: new Date(NOW.getTime() + 10 * 60 * 1000) });
    });

    it('purges expired attempts', async () => {
      const ctx = setup();
      await start(ctx);
      await start(ctx, new Date(NOW.getTime() + 11 * 60 * 1000));
      expect(ctx.repo.attempts.size).toBe(1);
    });
  });

  describe('callback', () => {
    it('consumes the state, exchanges the code with the verifier and stores the tokens encrypted', async () => {
      const ctx = setup();
      const { state, codeChallenge } = await start(ctx);
      await expect(ctx.useCase.complete({ code: 'TG-code', state }, NOW)).resolves.toBe('connected');

      const { codeVerifier } = ctx.gateway.exchangeCode.mock.calls[0][0];
      expect(ctx.gateway.exchangeCode).toHaveBeenCalledWith({ code: 'TG-code', codeVerifier });
      expect(s256(codeVerifier)).toBe(codeChallenge);
      expect(ctx.repo.attempts.size).toBe(0);

      const stored = ctx.repo.connections.get(BUSINESS)!;
      expect(JSON.stringify(stored)).not.toMatch(/APP_USR-access-1|TG-refresh-1/);
      expect(ctx.cipher.decrypt(stored.encryptedAccessToken)).toBe('APP_USR-access-1');
      expect(ctx.cipher.decrypt(stored.encryptedRefreshToken)).toBe('TG-refresh-1');
      expect(stored).toMatchObject({
        businessId: BUSINESS, mpUserId: '987654321', liveMode: true, scope: 'offline_access read write',
        accessTokenExpiresAt: new Date(NOW.getTime() + 180 * DAY_MS), connectedAt: NOW,
      });
    });

    it('is single use: replaying the same state fails without exchanging again', async () => {
      const ctx = setup();
      const { state } = await start(ctx);
      await ctx.useCase.complete({ code: 'TG-code', state }, NOW);
      await expect(ctx.useCase.complete({ code: 'TG-code', state }, NOW)).resolves.toBe('error');
      expect(ctx.gateway.exchangeCode).toHaveBeenCalledTimes(1);
    });

    it('rejects an expired state (after 10 minutes) and consumes it', async () => {
      const ctx = setup();
      const { state } = await start(ctx);
      await expect(ctx.useCase.complete({ code: 'TG-code', state }, new Date(NOW.getTime() + 10 * 60 * 1000))).resolves.toBe('error');
      expect(ctx.repo.attempts.size).toBe(0);
      expect(ctx.gateway.exchangeCode).not.toHaveBeenCalled();
      expect(ctx.repo.connections.size).toBe(0);
    });

    it.each([
      ['an unknown state', { code: 'TG-code', state: 'U'.repeat(43) }],
      ['a malformed state', { code: 'TG-code', state: 'short' }],
      ['no state', { code: 'TG-code' }],
      ['no code', { state: undefined as string | undefined }],
    ])('answers error for %s without calling Mercado Pago', async (_label, query) => {
      const ctx = setup();
      await start(ctx);
      await expect(ctx.useCase.complete(query, NOW)).resolves.toBe('error');
      expect(ctx.gateway.exchangeCode).not.toHaveBeenCalled();
      expect(ctx.repo.connections.size).toBe(0);
    });

    it('answers error when the owner denied access (error param), consuming the state', async () => {
      const ctx = setup();
      const { state } = await start(ctx);
      await expect(ctx.useCase.complete({ state, error: 'access_denied' }, NOW)).resolves.toBe('error');
      expect(ctx.repo.attempts.size).toBe(0);
      expect(ctx.gateway.exchangeCode).not.toHaveBeenCalled();
    });

    it('answers error when the code exchange fails', async () => {
      const ctx = setup();
      ctx.gateway.exchangeCode.mockRejectedValueOnce(new Error('Mercado Pago respondió 400 (invalid_grant)'));
      const { state } = await start(ctx);
      await expect(ctx.useCase.complete({ code: 'TG-code', state }, NOW)).resolves.toBe('error');
      expect(ctx.repo.connections.size).toBe(0);
    });

    it('answers error when the business changed owner since the attempt started', async () => {
      const ctx = setup();
      const { state } = await start(ctx);
      ctx.repo.owners.set(BUSINESS, 'someone-else');
      await expect(ctx.useCase.complete({ code: 'TG-code', state }, NOW)).resolves.toBe('error');
      expect(ctx.gateway.exchangeCode).not.toHaveBeenCalled();
    });
  });
});
