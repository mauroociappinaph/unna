export class PersonName {
  public readonly value: string;

  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 45;

  private constructor(value: string) {
    this.value = value.trim();
  }

  public static create(value: string): PersonName {
    if (!value || !value.trim()) {
      throw new Error('Este campo es obligatorio');
    }

    const trimmed = value.trim();

    if (trimmed.length < this.MIN_LENGTH) {
      throw new Error(`Tu nombre debe tener más de ${this.MIN_LENGTH} caracteres.`);
    }

    if (trimmed.length > this.MAX_LENGTH) {
      throw new Error(`Tu nombre debe tener menos de ${this.MAX_LENGTH} caracteres.`);
    }

    return new PersonName(trimmed);
  }

  public equals(other: PersonName): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}