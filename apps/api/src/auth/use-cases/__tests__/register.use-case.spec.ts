import { RegisterUseCase } from '../register.use-case';
import { User } from '@unna/domain';
import { Result, ok, err, isOk, isErr } from '@unna/domain';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let mockUserRepository: any;
  let mockHashingPort: any;
  let mockJwtPort: any;

  beforeEach(() => {
    mockUserRepository = {
      existsByEmail: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
    };
    mockHashingPort = {
      hash: jest.fn(),
      verify: jest.fn(),
    };
    mockJwtPort = {
      generateTokenPair: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      decodeToken: jest.fn(),
    };
    useCase = new RegisterUseCase(
      mockUserRepository,
      mockHashingPort,
      mockJwtPort,
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

  it('should fail if email already exists', async () => {
    mockUserRepository.existsByEmail.mockResolvedValue(true);

    const result = await useCase.execute(validCommand);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('El email ya está registrado');
    }
    expect(mockUserRepository.save).not.toHaveBeenCalled();
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