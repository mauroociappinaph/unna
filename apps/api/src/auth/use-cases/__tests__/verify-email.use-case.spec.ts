import { VerifyEmailUseCase } from '../verify-email.use-case';
import { Result, ok, err, isOk, isErr } from '@unna/domain';

const mockUserRepository = {
  existsByEmail: jest.fn(),
  save: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
};

const mockJwtPort = {
  generateTokenPair: jest.fn(),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  decodeToken: jest.fn(),
  generateResetToken: jest.fn(),
  verifyResetToken: jest.fn(),
};

const mockEmailPort = {
  sendEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerificationEmail: jest.fn(),
};

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new VerifyEmailUseCase(
      mockUserRepository as any,
      mockJwtPort as any,
      mockEmailPort as any,
    );
  });

  it('should fail if token is invalid', async () => {
    mockJwtPort.verifyResetToken.mockImplementation(() => {
      throw new Error('Token inválido');
    });

    const result = await useCase.execute({ token: 'invalid-token' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Token inválido o expirado.');
    }
  });

  it('should fail if token type is wrong', async () => {
    mockJwtPort.verifyResetToken.mockReturnValue({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'password_reset',
    });

    const result = await useCase.execute({ token: 'valid-token' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Token inválido.');
    }
  });

  it('should fail if user not found', async () => {
    mockJwtPort.verifyResetToken.mockReturnValue({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'email_verification',
    });
    mockUserRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute({ token: 'valid-token' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Usuario no encontrado.');
    }
  });

  it('should fail if email does not match', async () => {
    mockJwtPort.verifyResetToken.mockReturnValue({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'email_verification',
    });
    mockUserRepository.findById.mockResolvedValue({
      id: 'user-id',
      email: { value: 'other@example.com' },
      password: { hash: '$2b$10$hashed' },
      name: { value: 'Juan Pérez' },
      phone: { value: '+5491112345678' },
      businessName: 'Mi Restaurante',
      isActive: true,
      emailVerified: false,
      roles: ['owner'],
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      recordLogin: jest.fn(),
      changePassword: jest.fn(),
      deactivate: jest.fn(),
      verifyEmail: jest.fn(),
      addRole: jest.fn(),
      removeRole: jest.fn(),
      hasRole: jest.fn(),
      canManage: jest.fn(),
    });

    const result = await useCase.execute({ token: 'valid-token' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Token inválido.');
    }
  });

  it('should verify email successfully', async () => {
    const mockUser = {
      id: 'user-id',
      email: { value: 'test@example.com' },
      password: { hash: '$2b$10$hashed' },
      name: { value: 'Juan Pérez' },
      phone: { value: '+5491112345678' },
      businessName: 'Mi Restaurante',
      isActive: true,
      emailVerified: false,
      roles: ['owner'],
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      recordLogin: jest.fn(),
      changePassword: jest.fn(),
      deactivate: jest.fn(),
      verifyEmail: jest.fn(),
      addRole: jest.fn(),
      removeRole: jest.fn(),
      hasRole: jest.fn(),
      canManage: jest.fn(),
    };

    mockJwtPort.verifyResetToken.mockReturnValue({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'email_verification',
    });
    mockUserRepository.findById.mockResolvedValue(mockUser);
    mockUserRepository.save.mockResolvedValue(undefined);

    const result = await useCase.execute({ token: 'valid-token' });

    expect(isOk(result)).toBe(true);
    expect(mockUser.verifyEmail).toHaveBeenCalled();
    expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);
  });
});