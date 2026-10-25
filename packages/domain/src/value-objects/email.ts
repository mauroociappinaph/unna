export class Email {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value.toLowerCase().trim();
  }

  public static create(value: string): Email {
    if (!value || !value.trim()) {
      throw new Error('Email es obligatorio');
    }

    const trimmed = value.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(trimmed)) {
      throw new Error('Ingresá un e-mail válido. Ej.: nombre@gmail.com');
    }

    if (trimmed.length > 254) {
      throw new Error('El email no puede exceder 254 caracteres');
    }

    return new Email(trimmed);
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}