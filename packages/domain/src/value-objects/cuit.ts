export class CUIT {
  public readonly value: string;
  public readonly formatted: string;

  private constructor(value: string) {
    this.value = value.replace(/[-\s]/g, '');
    this.formatted = this.formatCUIT(this.value);
  }

  public static create(value: string): CUIT {
    if (!value || !value.trim()) {
      throw new Error('CUIT es obligatorio');
    }

    const cleaned = value.replace(/[-\s]/g, '');

    if (!/^\d{11}$/.test(cleaned)) {
      throw new Error('CUIT debe tener 11 dígitos numéricos');
    }

    if (!this.validateCUIT(cleaned)) {
      throw new Error('CUIT inválido (dígito verificador incorrecto)');
    }

    return new CUIT(cleaned);
  }

  private static validateCUIT(cuit: string): boolean {
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cuit[i], 10) * weights[i];
    }
    
    const remainder = sum % 11;
    let checkDigit: number;
    
    if (remainder === 0) {
      checkDigit = 0;
    } else if (remainder === 1) {
      checkDigit = 9;
    } else {
      checkDigit = 11 - remainder;
    }
    
    return checkDigit === parseInt(cuit[10], 10);
  }

  private formatCUIT(cuit: string): string {
    return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
  }

  public equals(other: CUIT): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.formatted;
  }
}