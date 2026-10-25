import { LoginUseCase } from '../login.use-case';
import { isOk, isErr, UserRepositoryPort, HashingPort, JwtPort } from '@unna/domain';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockUserRepository: Record<keyof UserRepositoryPort, jest.Mock>;
  let mockHashingPort: Record<keyof HashingPort, jest.Mock>;
  let mockJwtPort: Record<keyof JwtPort, jest.Mock>;

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
    useCase = new LoginUseCase(
      mockUserRepository,
      mockHashingPort,
      mockJwtPort,
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
});