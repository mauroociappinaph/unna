export class BusinessName {
  public readonly value: string;

  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 45;
  private static readonly ALLOWED_PATTERN = /^[a-zA-Z0-9\s&_-]+$/;

  private constructor(value: string) {
    this.value = value.trim();
  }

  public static create(value: string): BusinessName {
    if (!value || !value.trim()) {
      throw new Error('Este campo es obligatorio');
    }

    const trimmed = value.trim();

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