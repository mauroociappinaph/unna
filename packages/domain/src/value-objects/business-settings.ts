export type IVACondition = 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';

export type Currency = 'ARS' | 'USD';

export interface BusinessSettingsProps {
  tradeName: string;
  legalName?: string;
  ivaCondition: IVACondition;
  iibbNumber?: string;
  salePoint: string;  // 4 digits
  currency: Currency;
  timezone: string;
  language: string;
  logoUrl?: string;
}

export class BusinessSettings {
  public readonly tradeName: string;
  public readonly legalName: string | undefined;
  public readonly ivaCondition: IVACondition;
  public readonly iibbNumber: string | undefined;
  public readonly salePoint: string;
  public readonly currency: Currency;
  public readonly timezone: string;
  public readonly language: string;
  public readonly logoUrl: string | undefined;

  private constructor(props: BusinessSettingsProps) {
    this.tradeName = props.tradeName.trim();
    this.legalName = props.legalName?.trim();
    this.ivaCondition = props.ivaCondition;
    this.iibbNumber = props.iibbNumber?.trim();
    this.salePoint = props.salePoint.padStart(4, '0');
    this.currency = props.currency;
    this.timezone = props.timezone;
    this.language = props.language;
    this.logoUrl = props.logoUrl?.trim();
  }

  public static create(props: BusinessSettingsProps): BusinessSettings {
    if (!props.tradeName || !props.tradeName.trim()) {
      throw new Error('Nombre comercial es obligatorio');
    }
    if (props.tradeName.length > 100) {
      throw new Error('Nombre comercial no puede exceder 100 caracteres');
    }

    const validIVAConditions: IVACondition[] = ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'];
    if (!validIVAConditions.includes(props.ivaCondition)) {
      throw new Error('Condición de IVA inválida');
    }

    if (!props.salePoint || !/^\d{1,4}$/.test(props.salePoint)) {
      throw new Error('Punto de venta debe ser numérico de 1 a 4 dígitos');
    }

    const validCurrencies: Currency[] = ['ARS', 'USD'];
    if (!validCurrencies.includes(props.currency)) {
      throw new Error('Moneda inválida (ARS o USD)');
    }

    if (!props.timezone) {
      throw new Error('Zona horaria es obligatoria');
    }

    if (!props.language) {
      throw new Error('Idioma es obligatorio');
    }

    return new BusinessSettings(props);
  }

  public update(props: Partial<BusinessSettingsProps>): BusinessSettings {
    return BusinessSettings.create({
      tradeName: props.tradeName ?? this.tradeName,
      legalName: props.legalName ?? this.legalName,
      ivaCondition: props.ivaCondition ?? this.ivaCondition,
      iibbNumber: props.iibbNumber ?? this.iibbNumber,
      salePoint: props.salePoint ?? this.salePoint,
      currency: props.currency ?? this.currency,
      timezone: props.timezone ?? this.timezone,
      language: props.language ?? this.language,
      logoUrl: props.logoUrl ?? this.logoUrl,
    });
  }

  public equals(other: BusinessSettings): boolean {
    return (
      this.tradeName === other.tradeName &&
      this.legalName === other.legalName &&
      this.ivaCondition === other.ivaCondition &&
      this.iibbNumber === other.iibbNumber &&
      this.salePoint === other.salePoint &&
      this.currency === other.currency &&
      this.timezone === other.timezone &&
      this.language === other.language &&
      this.logoUrl === other.logoUrl
    );
  }
}