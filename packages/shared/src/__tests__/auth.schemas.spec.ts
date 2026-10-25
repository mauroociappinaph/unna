import { registerRequestSchema, loginRequestSchema } from '../schemas/auth.schemas';

describe('Shared Auth Schemas', () => {
  describe('registerRequestSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        businessName: 'Mi Restaurante',
        name: 'Juan Pérez',
        phone: '1112345678',
        email: 'test@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: true,
      };

      const result = registerRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject short business name', () => {
      const data = {
        businessName: 'Ab',
        name: 'Juan Pérez',
        phone: '11 1234 5678',
        email: 'test@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: true,
      };

      const result = registerRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const data = {
        businessName: 'Mi Restaurante',
        name: 'Juan Pérez',
        phone: '11 1234 5678',
        email: 'invalid-email',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: true,
      };

      const result = registerRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject weak password', () => {
      const data = {
        businessName: 'Mi Restaurante',
        name: 'Juan Pérez',
        phone: '11 1234 5678',
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        acceptTerms: true,
      };

      const result = registerRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject mismatched passwords', () => {
      const data = {
        businessName: 'Mi Restaurante',
        name: 'Juan Pérez',
        phone: '11 1234 5678',
        email: 'test@example.com',
        password: 'SecurePass123',
        confirmPassword: 'DifferentPass123',
        acceptTerms: true,
      };

      const result = registerRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing acceptTerms', () => {
      const data = {
        businessName: 'Mi Restaurante',
        name: 'Juan Pérez',
        phone: '11 1234 5678',
        email: 'test@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: false,
      };

      const result = registerRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('loginRequestSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'SecurePass123',
      };

      const result = loginRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'SecurePass123',
      };

      const result = loginRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const data = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});