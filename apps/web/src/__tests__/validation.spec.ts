import { registerRequestSchema } from '@unna/shared';

describe('Web App - Form Validation', () => {
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
  });
});