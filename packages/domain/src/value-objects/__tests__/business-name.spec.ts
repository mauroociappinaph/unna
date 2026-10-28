import { BusinessName } from '../business-name';

describe('BusinessName Value Object', () => {
  describe('create', () => {
    it('should create a valid business name', () => {
      const name = BusinessName.create('Mi Restaurante');
      expect(name.value).toBe('Mi Restaurante');
    });

    it('should trim whitespace', () => {
      const name = BusinessName.create('  Mi Restaurante  ');
      expect(name.value).toBe('Mi Restaurante');
    });

    it('should throw for empty name', () => {
      expect(() => BusinessName.create('')).toThrow('Este campo es obligatorio');
      expect(() => BusinessName.create('   ')).toThrow('Este campo es obligatorio');
    });

    it('should throw for name shorter than 3 chars', () => {
      expect(() => BusinessName.create('Ab')).toThrow('más de 3 caracteres');
    });

    it('should throw for name longer than 45 chars', () => {
      const longName = 'A'.repeat(46);
      expect(() => BusinessName.create(longName)).toThrow('menos de 45 caracteres');
    });

    it('should throw for invalid characters', () => {
      expect(() => BusinessName.create('Mi@Restaurante')).toThrow('caracteres alfanuméricos');
      expect(() => BusinessName.create('Mi#Restaurante')).toThrow('caracteres alfanuméricos');
    });

    it('accepts Spanish letters with accents, ñ and ü', () => {
      expect(BusinessName.create('Café Ñandú').value).toBe('Café Ñandú');
      expect(BusinessName.create('Pingüino & Cía').value).toBe('Pingüino & Cía');
    });

    it('should allow valid special characters & - _', () => {
      expect(BusinessName.create('Mi & Restaurante').value).toBe('Mi & Restaurante');
      expect(BusinessName.create('Mi-Restaurante').value).toBe('Mi-Restaurante');
      expect(BusinessName.create('Mi_Restaurante').value).toBe('Mi_Restaurante');
    });
  });

  describe('equals', () => {
    it('should return true for same name', () => {
      const n1 = BusinessName.create('Mi Restaurante');
      const n2 = BusinessName.create('Mi Restaurante');
      expect(n1.equals(n2)).toBe(true);
    });

    it('should return false for different names', () => {
      const n1 = BusinessName.create('Mi Restaurante');
      const n2 = BusinessName.create('Otro Restaurante');
      expect(n1.equals(n2)).toBe(false);
    });
  });
});