export class BusinessName {
  public readonly value: string;

  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 45;
  // Accent marks are allowed only after a letter, so "é" typed as "e" + U+0301 is accepted.
  private static readonly ALLOWED_PATTERN = /^(?:\p{L}\p{M}*|[\p{N}\s&_-])+$/u;

  private constructor(value: string) {
    this.value = value.trim();
  }

  public static create(value: string): BusinessName {
    if (!value || !value.trim()) {
      throw new Error('Este campo es obligatorio');
    }

    // Stored composed (NFC), so the same name typed with separate accent marks is equal.
    const trimmed = value.trim().normalize('NFC');

    if (trimmed.length < this.MIN_LENGTH) {
      throw new Error(`El nombre del negocio debe tener más de ${this.MIN_LENGTH} caracteres.`);
    }

    if (trimmed.length > this.MAX_LENGTH) {
      throw new Error(`El nombre del negocio debe tener menos de ${this.MAX_LENGTH} caracteres.`);
    }

    if (!this.ALLOWED_PATTERN.test(trimmed)) {
      throw new Error('Solamente caracteres alfanuméricos y los símbolos: &, - y _.');
    }

    return new BusinessName(trimmed);
  }

  public equals(other: BusinessName): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}