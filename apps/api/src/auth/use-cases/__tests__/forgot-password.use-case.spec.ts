import { ForgotPasswordUseCase } from '../forgot-password.use-case';
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

describe('ForgotPasswordUseCase', () => {
  let useCase: ForgotPasswordUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ForgotPasswordUseCase(
      mockUserRepository as any,
      mockJwtPort as any,
      mockEmailPort as any,
    );
  });

  it('should return ok if user does not exist (no email enumeration)', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'nonexistent@example.com' });

    expect(isOk(result)).toBe(true);
    expect(mockEmailPort.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should send reset email if user exists', async () => {
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

    mockUserRepository.findByEmail.mockResolvedValue(mockUser);
    mockJwtPort.generateResetToken.mockReturnValue('reset-token-123');
    mockEmailPort.sendPasswordResetEmail.mockResolvedValue(undefined);

    const result = await useCase.execute({ email: 'test@example.com' });

    expect(isOk(result)).toBe(true);
    expect(mockJwtPort.generateResetToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-id', email: 'test@example.com', type: 'password_reset' })
    );
    expect(mockEmailPort.sendPasswordResetEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining('reset-token-123')
    );
  });
});