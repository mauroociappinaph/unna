import { ForgotPasswordUseCase } from '../forgot-password.use-case';
import { isOk } from '@unna/domain';

const mockUserRepository = {
  existsByEmail: jest.fn(),
  save: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  delete: jest.fn(),
};

const mockJwtPort = {
  generateTokenPair: jest.fn(),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
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
      mockUserRepository,
      mockJwtPort,
      mockEmailPort,
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

  it('links to the recovery page of FRONTEND_URL', async () => {
    const old = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.unna.test/';
    try {
      mockUserRepository.findByEmail.mockResolvedValue({ id: 'user-id', email: { value: 'test@example.com' }, password: { hash: '$2b$10$hashed' } });
      mockJwtPort.generateResetToken.mockReturnValue('reset-token-123');

      await useCase.execute({ email: 'test@example.com' });

      expect(mockEmailPort.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com', 'https://app.unna.test/recuperar-contrasena?token=reset-token-123');
    } finally {
      if (old === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = old;
    }
  });

  // S21: the answer for an existing account must not wait for the mail provider (timing reveals existence).
  const existingUser = { id: 'user-id', email: { value: 'test@example.com' }, password: { hash: '$2b$10$hashed' } };

  it('does not wait for the email to be sent', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(existingUser);
    mockJwtPort.generateResetToken.mockReturnValue('reset-token-123');
    mockEmailPort.sendPasswordResetEmail.mockReturnValue(new Promise(() => undefined));

    const result = await useCase.execute({ email: 'test@example.com' });

    expect(isOk(result)).toBe(true);
    expect(mockEmailPort.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('answers ok even when the email provider fails', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(existingUser);
    mockJwtPort.generateResetToken.mockReturnValue('reset-token-123');
    mockEmailPort.sendPasswordResetEmail.mockRejectedValue(new Error('resend down'));

    const result = await useCase.execute({ email: 'test@example.com' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(isOk(result)).toBe(true);
  });

  it('signs the reset token with the fingerprint of the current password', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(existingUser);
    mockJwtPort.generateResetToken.mockReturnValue('reset-token-123');
    mockEmailPort.sendPasswordResetEmail.mockResolvedValue(undefined);

    await useCase.execute({ email: 'test@example.com' });

    expect(mockJwtPort.generateResetToken).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'password_reset',
      pwd: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
  });
});
