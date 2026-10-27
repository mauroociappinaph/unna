import { LoginUseCase } from '../login.use-case';
import { ConfigService } from '@nestjs/config';
import { isOk, isErr, UserRepositoryPort, HashingPort, JwtPort } from '@unna/domain';
import { SessionIssuer } from '../../session-issuer';
import { InMemoryRefreshSessions } from '../../__tests__/in-memory-refresh-sessions';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockUserRepository: Record<keyof UserRepositoryPort, jest.Mock>;
  let mockHashingPort: Record<keyof HashingPort, jest.Mock>;
  let mockJwtPort: Record<keyof JwtPort, jest.Mock>;
  let sessions: InMemoryRefreshSessions;

  beforeEach(() => {
    mockUserRepository = {
      existsByEmail: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      delete: jest.fn(),
    };
    mockHashingPort = {
      hash: jest.fn(),
      verify: jest.fn(),
    };
    mockJwtPort = {
      generateTokenPair: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      decodeToken: jest.fn(),
      generateResetToken: jest.fn(),
      verifyResetToken: jest.fn(),
    };
    sessions = new InMemoryRefreshSessions();
    useCase = new LoginUseCase(
      mockUserRepository,
      mockHashingPort,
      new SessionIssuer(mockJwtPort, sessions, { get: () => undefined } as unknown as ConfigService),
    );
  });

  const validCommand = {
    email: 'test@example.com',
    password: 'SecurePass123',
  };

  const createMockUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-id',
    email: { value: 'test@example.com' },
    password: { hash: '$2b$10$hashedpassword' },
    name: { value: 'Juan Pérez' },
    phone: { value: '+5491112345678' },
    businessName: 'Mi Restaurante',
    isActive: true,
    roles: ['owner'],
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    recordLogin: jest.fn(),
    ...overrides,
  });

  it('should login successfully with valid credentials', async () => {
    const mockUser = createMockUser();

    mockUserRepository.findByEmail.mockResolvedValue(mockUser);
    mockHashingPort.verify.mockResolvedValue(true);
    mockJwtPort.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
    });

    const result = await useCase.execute(validCommand);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.user.email.value).toBe('test@example.com');
      expect(result.value.tokens.accessToken).toBe('access-token');
    }
  });

  it('should fail if user not found', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute(validCommand);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Credenciales inválidas');
    }
  });

  it('should fail if password is incorrect', async () => {
    const mockUser = createMockUser();

    mockUserRepository.findByEmail.mockResolvedValue(mockUser);
    mockHashingPort.verify.mockResolvedValue(false);

    const result = await useCase.execute(validCommand);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Credenciales inválidas');
    }
  });

  it('should fail if user is inactive', async () => {
    const mockUser = createMockUser({ isActive: false });

    mockUserRepository.findByEmail.mockResolvedValue(mockUser);
    mockHashingPort.verify.mockResolvedValue(true);

    const result = await useCase.execute(validCommand);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Cuenta desactivada');
    }
  });

  it('should verify password with hashing port', async () => {
    const mockUser = createMockUser();

    mockUserRepository.findByEmail.mockResolvedValue(mockUser);
    mockHashingPort.verify.mockResolvedValue(true);
    mockJwtPort.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
    });

    await useCase.execute(validCommand);

    expect(mockHashingPort.verify).toHaveBeenCalledWith('SecurePass123', '$2b$10$hashedpassword');
  });

  // S21: the answer must not reveal whether an account exists or is deactivated without its password.
  it('answers Credenciales inválidas for a deactivated account when the password is wrong', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(createMockUser({ isActive: false }));
    mockHashingPort.verify.mockResolvedValue(false);

    const result = await useCase.execute(validCommand);

    expect(isErr(result) && result.error.message).toBe('Credenciales inválidas');
    expect(mockJwtPort.generateTokenPair).not.toHaveBeenCalled();
  });

  it('compares the password against a dummy bcrypt hash when the user does not exist, so timing is similar', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockHashingPort.verify.mockResolvedValue(true);

    const result = await useCase.execute(validCommand);

    expect(isErr(result) && result.error.message).toBe('Credenciales inválidas');
    expect(mockHashingPort.verify).toHaveBeenCalledTimes(1);
    expect(mockHashingPort.verify).toHaveBeenCalledWith('SecurePass123', expect.stringMatching(/^\$2[aby]\$12\$.{53}$/));
  });

  it('puts the password fingerprint and the access/refresh claims in the session', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(createMockUser());
    mockHashingPort.verify.mockResolvedValue(true);
    mockJwtPort.generateTokenPair.mockReturnValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });

    await useCase.execute(validCommand);

    expect(mockJwtPort.generateTokenPair).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'test@example.com',
      role: 'owner',
      businessId: undefined,
      pwd: expect.stringMatching(/^[0-9a-f]{16}$/),
      jti: expect.any(String),
      fam: expect.any(String),
    });
  });

  // S21: every login starts a new family of single-use refresh sessions.
  it('stores the first refresh session of a new family, named by the token claims', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(createMockUser());
    mockHashingPort.verify.mockResolvedValue(true);
    mockJwtPort.generateTokenPair.mockReturnValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });

    await useCase.execute(validCommand);

    const { jti, fam } = mockJwtPort.generateTokenPair.mock.calls[0][0];
    expect(fam).toBe(jti);
    expect(sessions.family(fam)).toEqual([expect.objectContaining({ id: jti, userId: 'user-id', usedAt: null, revokedAt: null, replacedById: null })]);
  });

  it('stores no session when the credentials are wrong', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(createMockUser());
    mockHashingPort.verify.mockResolvedValue(false);

    await useCase.execute(validCommand);

    expect(sessions.byId.size).toBe(0);
  });
});
