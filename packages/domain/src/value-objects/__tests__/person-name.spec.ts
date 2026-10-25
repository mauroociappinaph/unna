import { PersonName } from '../person-name';

describe('PersonName Value Object', () => {
  describe('create', () => {
    it('should create a valid person name', () => {
      const name = PersonName.create('Juan Pérez');
      expect(name.value).toBe('Juan Pérez');
    });

    it('should trim whitespace', () => {
      const name = PersonName.create('  Juan Pérez  ');
      expect(name.value).toBe('Juan Pérez');
    });

    it('should throw for empty name', () => {
      expect(() => PersonName.create('')).toThrow('Este campo es obligatorio');
      expect(() => PersonName.create('   ')).toThrow('Este campo es obligatorio');
    });

    it('should throw for name shorter than 3 chars', () => {
      expect(() => PersonName.create('Jo')).toThrow('más de 3 caracteres');
    });

    it('should throw for name longer than 45 chars', () => {
      const longName = 'A'.repeat(46);
      expect(() => PersonName.create(longName)).toThrow('menos de 45 caracteres');
    });
  });

  describe('equals', () => {
    it('should return true for same name', () => {
      const n1 = PersonName.create('Juan Pérez');
      const n2 = PersonName.create('Juan Pérez');
      expect(n1.equals(n2)).toBe(true);
    });

    it('should return false for different names', () => {
      const n1 = PersonName.create('Juan Pérez');
      const n2 = PersonName.create('María García');
      expect(n1.equals(n2)).toBe(false);
    });
  });
});