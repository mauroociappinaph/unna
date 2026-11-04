import { Password } from '../password';

describe('Password Value Object', () => {
  describe('create', () => {
    it('should create a valid password', () => {
      const password = Password.create('SecurePass123');
      expect(password.value).toBe('SecurePass123');
      expect(password.isHashed).toBe(false);
    });

    it('should throw for empty password', () => {
      expect(() => Password.create('')).toThrow('Este campo es obligatorio');
    });

    it('should throw for password shorter than 8 chars', () => {
      expect(() => Password.create('Pass1')).toThrow('mínimo 8 caracteres');
    });

    it('should throw for password without uppercase', () => {
      expect(() => Password.create('password123')).toThrow('mayúscula');
    });

    it('should throw for password without lowercase', () => {
      expect(() => Password.create('PASSWORD123')).toThrow('minúscula');
    });

    it('should throw for password without number', () => {
      expect(() => Password.create('Password')).toThrow('número');
    });
  });

  describe('setHashed', () => {
    it('should return new instance with hashed value', () => {
      const password = Password.create('SecurePass123');
      const hashed = password.setHashed('$2b$10$hashedvalue');
      expect(hashed.hash).toBe('$2b$10$hashedvalue');
      expect(hashed.isHashed).toBe(true);
      expect(password.isHashed).toBe(false); // original unchanged
    });
  });

  describe('fromHash', () => {
    it('should create password from hash', () => {
      const password = Password.fromHash('$2b$10$hashedvalue');
      expect(password.isHashed).toBe(true);
      expect(password.hash).toBe('$2b$10$hashedvalue');
    });
  });

  describe('equals', () => {
    it('should return true for same plain passwords', () => {
      const p1 = Password.create('SecurePass123');
      const p2 = Password.create('SecurePass123');
      expect(p1.equals(p2)).toBe(true);
    });

    it('should return true for same hashed passwords', () => {
      const p1 = Password.fromHash('$2b$10$samehash');
      const p2 = Password.fromHash('$2b$10$samehash');
      expect(p1.equals(p2)).toBe(true);
    });

    it('should return false for different passwords', () => {
      const p1 = Password.create('SecurePass123');
      const p2 = Password.create('DifferentPass123');
      expect(p1.equals(p2)).toBe(false);
    });
  });
});