import { Phone } from '../phone';

describe('Phone Value Object', () => {
  describe('create', () => {
    it('should create a valid Argentine phone', () => {
      const phone = Phone.create('1112345678');
      expect(phone.value).toBe('+5491112345678');
      expect(phone.nationalFormat).toBe('11 1234 5678');
    });

    it('should throw for empty phone', () => {
      expect(() => Phone.create('')).toThrow('Este campo es obligatorio');
      expect(() => Phone.create('   ')).toThrow('Este campo es obligatorio');
    });

    it('should throw for invalid phone format', () => {
      expect(() => Phone.create('123')).toThrow('Ingresá un teléfono válido');
      expect(() => Phone.create('abc')).toThrow('Ingresá un teléfono válido');
    });

    it('should accept various formats', () => {
      expect(Phone.create('11 1234 5678').nationalFormat).toBe('11 1234 5678');
      expect(Phone.create('+54 9 11 1234 5678').nationalFormat).toBe('11 1234 5678');
    });
  });

  describe('format', () => {
    it('should have nationalFormat property', () => {
      const phone = Phone.create('1112345678');
      expect(phone.nationalFormat).toBe('11 1234 5678');
    });

    it('should have internationalFormat property', () => {
      const phone = Phone.create('1112345678');
      expect(phone.internationalFormat).toBe('+54 9 11 1234 5678');
    });
  });

  describe('equals', () => {
    it('should return true for same phone', () => {
      const p1 = Phone.create('1112345678');
      const p2 = Phone.create('1112345678');
      expect(p1.equals(p2)).toBe(true);
    });

    it('should return false for different phones', () => {
      const p1 = Phone.create('1112345678');
      const p2 = Phone.create('1187654321');
      expect(p1.equals(p2)).toBe(false);
    });
  });
});