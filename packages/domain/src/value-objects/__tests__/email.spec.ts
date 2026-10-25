import { Email } from '../email';

describe('Email Value Object', () => {
  describe('create', () => {
    it('should create a valid email', () => {
      const email = Email.create('test@example.com');
      expect(email.value).toBe('test@example.com');
    });

    it('should normalize email to lowercase and trim', () => {
      const email = Email.create('  TEST@EXAMPLE.COM  ');
      expect(email.value).toBe('test@example.com');
    });

    it('should throw for empty email', () => {
      expect(() => Email.create('')).toThrow('Email es obligatorio');
      expect(() => Email.create('   ')).toThrow('Email es obligatorio');
    });

    it('should throw for invalid email format', () => {
      expect(() => Email.create('invalid')).toThrow('Ingresá un e-mail válido');
      expect(() => Email.create('test@')).toThrow('Ingresá un e-mail válido');
      expect(() => Email.create('@example.com')).toThrow('Ingresá un e-mail válido');
      expect(() => Email.create('test@.com')).toThrow('Ingresá un e-mail válido');
    });

    it('should throw for email longer than 254 chars', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => Email.create(longEmail)).toThrow('no puede exceder 254 caracteres');
    });
  });

  describe('equals', () => {
    it('should return true for same email', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different emails', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('other@example.com');
      expect(email1.equals(email2)).toBe(false);
    });
  });
});