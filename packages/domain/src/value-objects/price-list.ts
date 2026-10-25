import { Money } from './money';

export interface PriceListEntryProps {
  productId: string;
  price: Money;
  costPrice?: Money;
  isActive: boolean;
}

export class PriceListEntry {
  public readonly productId: string;
  public readonly price: Money;
  public readonly costPrice: Money | undefined;
  public readonly isActive: boolean;

  private constructor(props: PriceListEntryProps) {
    this.productId = props.productId;
    this.price = props.price;
    this.costPrice = props.costPrice;
    this.isActive = props.isActive;
  }

  public static create(props: PriceListEntryProps): PriceListEntry {
    return new PriceListEntry(props);
  }

  public static reconstitute(props: PriceListEntryProps): PriceListEntry {
    return new PriceListEntry(props);
  }

  public updatePrice(price: Money): PriceListEntry {
    if (price.amount < 0) throw new Error('Precio no puede ser negativo');
    return new PriceListEntry({ ...this.toProps(), price });
  }

  public updateCostPrice(costPrice?: Money): PriceListEntry {
    if (costPrice && costPrice.amount < 0) throw new Error('Costo no puede ser negativo');
    return new PriceListEntry({ ...this.toProps(), costPrice });
  }

  public activate(): PriceListEntry {
    return new PriceListEntry({ ...this.toProps(), isActive: true });
  }

  public deactivate(): PriceListEntry {
    return new PriceListEntry({ ...this.toProps(), isActive: false });
  }

  private toProps(): PriceListEntryProps {
    return {
      productId: this.productId,
      price: this.price,
      costPrice: this.costPrice,
      isActive: this.isActive,
    };
  }
}

export type PriceListType = 'standard' | 'delivery' | 'takeaway' | 'happy-hour' | 'event' | 'custom';

export interface PriceListProps {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  type: PriceListType;
  isDefault: boolean;
  isActive: boolean;
  validFrom?: Date;
  validTo?: Date;
  validDays?: number[];  // 0=Sunday, 1=Monday, etc.
  validFromTime?: string;  // HH:mm
  validToTime?: string;    // HH:mm
  entries: PriceListEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export class PriceList {
  public readonly id: string;
  public readonly businessId: string;
  public readonly name: string;
  public readonly description: string | undefined;
  public readonly type: PriceListType;
  public readonly isDefault: boolean;
  public readonly isActive: boolean;
  public readonly validFrom: Date | undefined;
  public readonly validTo: Date | undefined;
  public readonly validDays: number[] | undefined;
  public readonly validFromTime: string | undefined;
  public readonly validToTime: string | undefined;
  public readonly entries: PriceListEntry[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: PriceListProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.name = props.name.trim();
    this.description = props.description?.trim();
    this.type = props.type;
    this.isDefault = props.isDefault;
    this.isActive = props.isActive;
    this.validFrom = props.validFrom;
    this.validTo = props.validTo;
    this.validDays = props.validDays;
    this.validFromTime = props.validFromTime;
    this.validToTime = props.validToTime;
    this.entries = props.entries;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<PriceListProps, 'id' | 'createdAt' | 'updatedAt'>): PriceList {
    if (!props.name || !props.name.trim()) {
      throw new Error('Nombre de lista de precios es obligatorio');
    }
    if (props.name.length > 80) {
      throw new Error('Nombre no puede exceder 80 caracteres');
    }

    const validTypes: PriceListType[] = ['standard', 'delivery', 'takeaway', 'happy-hour', 'event', 'custom'];
    if (!validTypes.includes(props.type)) {
      throw new Error('Tipo de lista de precios inválido');
    }

    if (props.validFrom && props.validTo && props.validFrom >= props.validTo) {
      throw new Error('Fecha de inicio debe ser anterior a fecha de fin');
    }

    if (props.validFromTime && props.validToTime && props.validFromTime >= props.validToTime) {
      throw new Error('Hora de inicio debe ser anterior a hora de fin');
    }

    if (props.validDays) {
      const validDays = new Set(props.validDays);
      if (validDays.size !== props.validDays.length) {
        throw new Error('Días válidos no pueden repetirse');
      }
      for (const day of props.validDays) {
        if (day < 0 || day > 6) throw new Error('Días válidos deben estar entre 0 y 6');
      }
    }

    const now = new Date();
    return new PriceList({
      ...props,
      id: crypto.randomUUID(),
      name: props.name.trim(),
      description: props.description?.trim(),
      entries: props.entries ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: PriceListProps): PriceList {
    return new PriceList(props);
  }

  public updateName(name: string): PriceList {
    if (!name || !name.trim()) throw new Error('Nombre es obligatorio');
    return new PriceList({ ...this.toProps(), name: name.trim(), updatedAt: new Date() });
  }

  public updateDescription(description?: string): PriceList {
    return new PriceList({ ...this.toProps(), description: description?.trim(), updatedAt: new Date() });
  }

  public setAsDefault(): PriceList {
    return new PriceList({ ...this.toProps(), isDefault: true, updatedAt: new Date() });
  }

  public unsetAsDefault(): PriceList {
    return new PriceList({ ...this.toProps(), isDefault: false, updatedAt: new Date() });
  }

  public setValidityPeriod(from?: Date, to?: Date): PriceList {
    if (from && to && from >= to) {
      throw new Error('Fecha de inicio debe ser anterior a fecha de fin');
    }
    return new PriceList({ ...this.toProps(), validFrom: from, validTo: to, updatedAt: new Date() });
  }

  public setValidDays(days: number[]): PriceList {
    const validDays = new Set(days);
    if (validDays.size !== days.length) {
      throw new Error('Días válidos no pueden repetirse');
    }
    for (const day of days) {
      if (day < 0 || day > 6) throw new Error('Días válidos deben estar entre 0 y 6');
    }
    return new PriceList({ ...this.toProps(), validDays: days, updatedAt: new Date() });
  }

  public setValidHours(from?: string, to?: string): PriceList {
    if (from && to && from >= to) {
      throw new Error('Hora de inicio debe ser anterior a hora de fin');
    }
    return new PriceList({ ...this.toProps(), validFromTime: from, validToTime: to, updatedAt: new Date() });
  }

  public addEntry(entry: PriceListEntry): PriceList {
    if (this.entries.some(e => e.productId === entry.productId)) {
      throw new Error('El producto ya existe en esta lista de precios');
    }
    return new PriceList({
      ...this.toProps(),
      entries: [...this.entries, entry],
      updatedAt: new Date(),
    });
  }

  public removeEntry(productId: string): PriceList {
    return new PriceList({
      ...this.toProps(),
      entries: this.entries.filter(e => e.productId !== productId),
      updatedAt: new Date(),
    });
  }

  public updateEntry(productId: string, updater: (entry: PriceListEntry) => PriceListEntry): PriceList {
    return new PriceList({
      ...this.toProps(),
      entries: this.entries.map(e => e.productId === productId ? updater(e) : e),
      updatedAt: new Date(),
    });
  }

  public setEntryPrice(productId: string, price: Money): PriceList {
    return this.updateEntry(productId, e => e.updatePrice(price));
  }

  public getEntry(productId: string): PriceListEntry | undefined {
    return this.entries.find(e => e.productId === productId);
  }

  public getPriceForProduct(productId: string): Money | undefined {
    const entry = this.entries.find(e => e.productId === productId && e.isActive);
    return entry?.price;
  }

  public activate(): PriceList {
    return new PriceList({ ...this.toProps(), isActive: true, updatedAt: new Date() });
  }

  public deactivate(): PriceList {
    return new PriceList({ ...this.toProps(), isActive: false, updatedAt: new Date() });
  }

  public isValidAt(date: Date = new Date(), time?: string): boolean {
    if (!this.isActive) return false;
    if (this.validFrom && date < this.validFrom) return false;
    if (this.validTo && date > this.validTo) return false;
    if (this.validDays && !this.validDays.includes(date.getDay())) return false;
    if (time && this.validFromTime && time < this.validFromTime) return false;
    if (time && this.validToTime && time > this.validToTime) return false;
    return true;
  }

  private toProps(): PriceListProps {
    return {
      id: this.id,
      businessId: this.businessId,
      name: this.name,
      description: this.description,
      type: this.type,
      isDefault: this.isDefault,
      isActive: this.isActive,
      validFrom: this.validFrom,
      validTo: this.validTo,
      validDays: this.validDays,
      validFromTime: this.validFromTime,
      validToTime: this.validToTime,
      entries: this.entries,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}