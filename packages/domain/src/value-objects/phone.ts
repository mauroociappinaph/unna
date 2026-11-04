export class Phone {
  public readonly value: string;
  public readonly nationalFormat: string;
  public readonly internationalFormat: string;

  private constructor(value: string) {
    this.value = value;
    this.nationalFormat = this.formatNational(value);
    this.internationalFormat = this.formatInternational(value);
  }

  public static create(value: string): Phone {
    if (!value || !value.trim()) {
      throw new Error('Este campo es obligatorio');
    }

    const cleaned = value.replace(/[\s\-()]/g, '');

    const argentinaPatterns = [
      /^(\+?54)?9?(\d{2})(\d{4})(\d{4})$/,  // +54 9 11 1234 5678 o 11 1234 5678
      /^(\+?54)?(\d{2})(\d{4})(\d{4})$/,    // +54 11 1234 5678 (sin 9)
      /^0?(\d{2})(\d{4})(\d{4})$/,          // 011 1234 5678
    ];

    let matched = false;
    let areaCode = '';
    let firstPart = '';
    let secondPart = '';

    for (const pattern of argentinaPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        matched = true;
        areaCode = match[2] || match[1];
        firstPart = match[3];
        secondPart = match[4];
        break;
      }
    }

    if (!matched) {
      throw new Error('Ingresá un teléfono válido. Ej.: 11 1234 5678');
    }

    const normalized = `+549${areaCode}${firstPart}${secondPart}`;
    return new Phone(normalized);
  }

  private formatNational(value: string): string {
    const match = value.match(/^\+549(\d{2})(\d{4})(\d{4})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]}`;
    }
    return value;
  }

  private formatInternational(value: string): string {
    const match = value.match(/^\+549(\d{2})(\d{4})(\d{4})$/);
    if (match) {
      return `+54 9 ${match[1]} ${match[2]} ${match[3]}`;
    }
    return value;
  }

  public equals(other: Phone): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.nationalFormat;
  }
}