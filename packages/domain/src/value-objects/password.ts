export class Password {
  public readonly value: string;
  public readonly hashedValue: string | null;

  private constructor(value: string, hashedValue: string | null = null) {
    this.value = value;
    this.hashedValue = hashedValue;
  }

  public static create(plainPassword: string): Password {
    if (!plainPassword) {
      throw new Error('Este campo es obligatorio');
    }

    const errors: string[] = [];

    if (plainPassword.length < 8) {
      errors.push('mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(plainPassword)) {
      errors.push('una mayúscula');
    }
    if (!/[a-z]/.test(plainPassword)) {
      errors.push('una minúscula');
    }
    if (!/[0-9]/.test(plainPassword)) {
      errors.push('un número');
    }

    if (errors.length > 0) {
      throw new Error(`Debe contener ${errors.join(', ')}.`);
    }

    return new Password(plainPassword);
  }

  public static fromHash(hashedPassword: string): Password {
    return new Password('', hashedPassword);
  }

  public setHashed(hashed: string): Password {
    return new Password(this.value, hashed);
  }

  public get isHashed(): boolean {
    return this.hashedValue !== null;
  }

  public get hash(): string {
    if (!this.hashedValue) {
      throw new Error('Password no tiene hash');
    }
    return this.hashedValue;
  }

  public equals(other: Password): boolean {
    if (this.isHashed && other.isHashed) {
      return this.hashedValue === other.hashedValue;
    }
    return this.value === other.value;
  }

  public toString(): string {
    return this.isHashed ? '[HASHED]' : this.value;
  }
}