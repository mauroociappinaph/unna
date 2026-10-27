import { RegisterUseCase } from '../register.use-case';
import { ConfigService } from '@nestjs/config';
import { isOk, isErr, UserRepositoryPort, HashingPort, JwtPort } from '@unna/domain';
import { SessionIssuer } from '../../session-issuer';
import { InMemoryRefreshSessions } from '../../__tests__/in-memory-refresh-sessions';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
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
    useCase = new RegisterUseCase(
      mockUserRepository,
      mockHashingPort,
      new SessionIssuer(mockJwtPort, sessions, { get: () => undefined } as unknown as ConfigService),
    );
  });

  const validCommand = {
    email: 'test@example.com',
    password: 'SecurePass123',
    name: 'Juan Pérez',
    phone: '1112345678',
    businessName: 'Mi Restaurante',
  };

  it('should register a new user successfully', async () => {
    mockUserRepository.existsByEmail.mockResolvedValue(false);
    mockHashingPort.hash.mockResolvedValue('$2b$10$hashedpassword');
    mockJwtPort.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
    });

    const result = await useCase.execute(validCommand);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.user.email.value).toBe('test@example.com');
      expect(result.value.user.name.value).toBe('Juan Pérez');
      expect(result.value.tokens.accessToken).toBe('access-token');
    }
    expect(mockUserRepository.save).toHaveBeenCalled();
    expect(mockHashingPort.hash).toHaveBeenCalled();
    expect(mockJwtPort.generateTokenPair).toHaveBeenCalled();
  });

  // S21: registering signs in, so it starts a family of single-use refresh sessions.
  it('stores the first refresh session of a new family for the new user', async () => {
    mockUserRepository.existsByEmail.mockResolvedValue(false);
    mockHashingPort.hash.mockResolvedValue('$2b$10$hashedpassword');
    mockJwtPort.generateTokenPair.mockReturnValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });

    const result = await useCase.execute(validCommand);

    const { jti, fam } = mockJwtPort.generateTokenPair.mock.calls[0][0];
    const userId = isOk(result) ? result.value.user.id : '';
    expect(sessions.family(fam)).toEqual([expect.objectContaining({ id: jti, familyId: jti, userId })]);
  });

  it('should fail if email already exists', async () => {
    mockUserRepository.existsByEmail.mockResolvedValue(true);

    const result = await useCase.execute(validCommand);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('El email ya está registrado');
    }
    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(sessions.byId.size).toBe(0);
  });

  it('should hash password before saving', async () => {
    mockUserRepository.existsByEmail.mockResolvedValue(false);
    mockHashingPort.hash.mockResolvedValue('$2b$10$hashedpassword');
    mockJwtPort.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
    });

    await useCase.execute(validCommand);

    expect(mockHashingPort.hash).toHaveBeenCalledWith('SecurePass123');
  });

  it('should clean phone number before creating VO', async () => {
    mockUserRepository.existsByEmail.mockResolvedValue(false);
    mockHashingPort.hash.mockResolvedValue('$2b$10$hashedpassword');
    mockJwtPort.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
    });

    await useCase.execute({
      ...validCommand,
      phone: '11 1234 5678', // with spaces
    });

    expect(mockUserRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: expect.objectContaining({ value: '+5491112345678' }),
      })
    );
  });
});