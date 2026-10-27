import { ResetPasswordUseCase } from '../reset-password.use-case';
import { isOk, isErr } from '@unna/domain';
import { passwordFingerprint } from '../../session-token';

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

const mockHashingPort = {
  hash: jest.fn(),
  verify: jest.fn(),
};

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ResetPasswordUseCase(
      mockUserRepository,
      mockJwtPort,
      mockHashingPort,
    );
  });

  it('should fail if passwords do not match', async () => {
    const result = await useCase.execute({
      token: 'valid-token',
      password: 'NewPass123',
      confirmPassword: 'DifferentPass123',
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Las contraseñas no coinciden.');
    }
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it('should fail if token is invalid', async () => {
    mockJwtPort.verifyResetToken.mockImplementation(() => {
      throw new Error('Token inválido');
    });

    const result = await useCase.execute({
      token: 'invalid-token',
      password: 'NewPass123',
      confirmPassword: 'NewPass123',
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Token inválido o expirado.');
    }
  });

  it('should fail if token type is wrong', async () => {
    mockJwtPort.verifyResetToken.mockReturnValue({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'email_verification',
    });

    const result = await useCase.execute({
      token: 'valid-token',
      password: 'NewPass123',
      confirmPassword: 'NewPass123',
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Token inválido.');
    }
  });

  it('should fail if user not found', async () => {
    mockJwtPort.verifyResetToken.mockReturnValue({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'password_reset',
    });
    mockUserRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute({
      token: 'valid-token',
      password: 'NewPass123',
      confirmPassword: 'NewPass123',
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Usuario no encontrado.');
    }
  });

  it('should fail if email does not match', async () => {
    mockJwtPort.verifyResetToken.mockReturnValue({
      sub: 'user-id',
      email: 'test@example.com',
      type: 'password_reset',
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

    const result = await useCase.execute({
      token: 'valid-token',
      password: 'NewPass123',
      confirmPassword: 'NewPass123',
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('Token inválido.');
    }
  });

  it('should reset password successfully', async () => {
    const mockUser = {
      id: 'user-id',
      email: { value: 'test@example.com' },
      password: { hash: '$2b$10$oldhashed' },
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
      type: 'password_reset',
      pwd: passwordFingerprint('$2b$10$oldhashed'),
    });
    mockUserRepository.findById.mockResolvedValue(mockUser);
    mockHashingPort.hash.mockResolvedValue('$2b$10$newhashed');
    mockUserRepository.save.mockResolvedValue(undefined);

    const result = await useCase.execute({
      token: 'valid-token',
      password: 'NewPass123',
      confirmPassword: 'NewPass123',
    });

    expect(isOk(result)).toBe(true);
    expect(mockHashingPort.hash).toHaveBeenCalledWith('NewPass123');
    expect(mockUser.changePassword).toHaveBeenCalled();
    expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);
  });

  // S21: a reset link works once; after the password changed (by this or another link) it is spent.
  it.each([
    ['the password already changed', passwordFingerprint('$2b$10$previoushash')],
    ['the link has no fingerprint (issued before S21)', undefined],
  ])('rejects the link when %s', async (_case, pwd) => {
    const user = { id: 'user-id', email: { value: 'test@example.com' }, password: { hash: '$2b$10$currenthash' }, changePassword: jest.fn() };
    mockJwtPort.verifyResetToken.mockReturnValue({ sub: 'user-id', email: 'test@example.com', type: 'password_reset', pwd });
    mockUserRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute({ token: 'used-token', password: 'NewPass123', confirmPassword: 'NewPass123' });

    expect(isErr(result) && result.error.message).toBe('El link ya se usó o venció. Pedí uno nuevo.');
    expect(user.changePassword).not.toHaveBeenCalled();
    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockHashingPort.hash).not.toHaveBeenCalled();
  });
});
