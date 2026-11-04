export class Address {
  public readonly street: string;
  public readonly number: string;
  public readonly floor?: string;
  public readonly apartment?: string;
  public readonly neighborhood?: string;
  public readonly city: string;
  public readonly province: string;
  public readonly postalCode: string;
  public readonly country: string;
  public readonly formatted: string;

  private constructor(props: AddressProps) {
    this.street = props.street.trim();
    this.number = props.number.trim();
    this.floor = props.floor?.trim();
    this.apartment = props.apartment?.trim();
    this.neighborhood = props.neighborhood?.trim();
    this.city = props.city.trim();
    this.province = props.province.trim();
    this.postalCode = props.postalCode.trim();
    this.country = props.country.trim();
    this.formatted = this.buildFormatted();
  }

  public static create(props: AddressProps): Address {
    if (!props.street || !props.street.trim()) {
      throw new Error('Calle es obligatoria');
    }
    if (!props.number || !props.number.trim()) {
      throw new Error('Número es obligatorio');
    }
    if (!props.city || !props.city.trim()) {
      throw new Error('Ciudad es obligatoria');
    }
    if (!props.province || !props.province.trim()) {
      throw new Error('Provincia es obligatoria');
    }
    if (!props.postalCode || !props.postalCode.trim()) {
      throw new Error('Código postal es obligatorio');
    }
    if (!props.country || !props.country.trim()) {
      throw new Error('País es obligatorio');
    }

    return new Address(props);
  }

  private buildFormatted(): string {
    let formatted = `${this.street} ${this.number}`;
    if (this.floor) formatted += `, Piso ${this.floor}`;
    if (this.apartment) formatted += `, Dpto ${this.apartment}`;
    if (this.neighborhood) formatted += `, ${this.neighborhood}`;
    formatted += `, ${this.city}, ${this.province}`;
    formatted += `, ${this.postalCode}, ${this.country}`;
    return formatted;
  }

  public equals(other: Address): boolean {
    return this.formatted === other.formatted;
  }

  public toString(): string {
    return this.formatted;
  }
}

interface AddressProps {
  street: string;
  number: string;
  floor?: string;
  apartment?: string;
  neighborhood?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}