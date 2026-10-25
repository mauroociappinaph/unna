export interface ModifierOptionProps {
  id: string;
  name: string;
  priceDelta: number;  // additional price for this option
  isDefault: boolean;
  displayOrder: number;
  isActive: boolean;
}

export class ModifierOption {
  public readonly id: string;
  public readonly name: string;
  public readonly priceDelta: number;
  public readonly isDefault: boolean;
  public readonly displayOrder: number;
  public readonly isActive: boolean;

  private constructor(props: ModifierOptionProps) {
    this.id = props.id;
    this.name = props.name.trim();
    this.priceDelta = props.priceDelta;
    this.isDefault = props.isDefault;
    this.displayOrder = props.displayOrder;
    this.isActive = props.isActive;
  }

  public static create(props: Omit<ModifierOptionProps, 'id'>): ModifierOption {
    if (!props.name || !props.name.trim()) {
      throw new Error('Nombre de opción es obligatorio');
    }
    return new ModifierOption({
      ...props,
      id: crypto.randomUUID(),
      name: props.name.trim(),
    });
  }

  public static reconstitute(props: ModifierOptionProps): ModifierOption {
    return new ModifierOption(props);
  }

  public updateName(name: string): ModifierOption {
    if (!name || !name.trim()) throw new Error('Nombre de opción es obligatorio');
    return new ModifierOption({ ...this.toProps(), name: name.trim() });
  }

  public updatePriceDelta(priceDelta: number): ModifierOption {
    return new ModifierOption({ ...this.toProps(), priceDelta });
  }

  public setAsDefault(): ModifierOption {
    return new ModifierOption({ ...this.toProps(), isDefault: true });
  }

  public unsetAsDefault(): ModifierOption {
    return new ModifierOption({ ...this.toProps(), isDefault: false });
  }

  public activate(): ModifierOption {
    return new ModifierOption({ ...this.toProps(), isActive: true });
  }

  public deactivate(): ModifierOption {
    return new ModifierOption({ ...this.toProps(), isActive: false });
  }

  protected toProps(): ModifierOptionProps {
    return {
      id: this.id,
      name: this.name,
      priceDelta: this.priceDelta,
      isDefault: this.isDefault,
      displayOrder: this.displayOrder,
      isActive: this.isActive,
    };
  }
}

export interface ModifierGroupProps {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  minSelection: number;  // minimum options to select
  maxSelection: number;  // maximum options to select (0 = unlimited)
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  options: ModifierOption[];
  createdAt: Date;
  updatedAt: Date;
}

export class ModifierGroup {
  public readonly id: string;
  public readonly businessId: string;
  public readonly name: string;
  public readonly description: string | undefined;
  public readonly minSelection: number;
  public readonly maxSelection: number;
  public readonly isRequired: boolean;
  public readonly displayOrder: number;
  public readonly isActive: boolean;
  public readonly options: ModifierOption[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: ModifierGroupProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.name = props.name.trim();
    this.description = props.description?.trim();
    this.minSelection = props.minSelection;
    this.maxSelection = props.maxSelection;
    this.isRequired = props.isRequired;
    this.displayOrder = props.displayOrder;
    this.isActive = props.isActive;
    this.options = props.options;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<ModifierGroupProps, 'id' | 'createdAt' | 'updatedAt'>): ModifierGroup {
    if (!props.name || !props.name.trim()) {
      throw new Error('Nombre de grupo de modificadores es obligatorio');
    }
    if (props.name.length > 80) {
      throw new Error('Nombre no puede exceder 80 caracteres');
    }
    if (props.minSelection < 0) throw new Error('Mínima selección no puede ser negativa');
    if (props.maxSelection !== 0 && props.maxSelection < props.minSelection) {
      throw new Error('Máxima selección debe ser mayor o igual a mínima');
    }

    const now = new Date();
    return new ModifierGroup({
      ...props,
      id: crypto.randomUUID(),
      name: props.name.trim(),
      description: props.description?.trim(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ModifierGroupProps): ModifierGroup {
    return new ModifierGroup(props);
  }

  public updateName(name: string): ModifierGroup {
    if (!name || !name.trim()) throw new Error('Nombre es obligatorio');
    return new ModifierGroup({ ...this.toProps(), name: name.trim(), updatedAt: new Date() });
  }

  public updateDescription(description?: string): ModifierGroup {
    return new ModifierGroup({ ...this.toProps(), description: description?.trim(), updatedAt: new Date() });
  }

  public setMinSelection(min: number): ModifierGroup {
    if (min < 0) throw new Error('Mínima selección no puede ser negativa');
    if (this.maxSelection !== 0 && min > this.maxSelection) {
      throw new Error('Mínima no puede ser mayor a máxima');
    }
    return new ModifierGroup({ ...this.toProps(), minSelection: min, updatedAt: new Date() });
  }

  public setMaxSelection(max: number): ModifierGroup {
    if (max !== 0 && max < this.minSelection) {
      throw new Error('Máxima no puede ser menor a mínima');
    }
    return new ModifierGroup({ ...this.toProps(), maxSelection: max, updatedAt: new Date() });
  }

  public setRequired(required: boolean): ModifierGroup {
    return new ModifierGroup({ ...this.toProps(), isRequired: required, updatedAt: new Date() });
  }

  public addOption(option: ModifierOption): ModifierGroup {
    if (this.maxSelection !== 0 && this.options.length >= this.maxSelection && this.maxSelection > 0) {
      throw new Error('Se alcanzó el máximo de opciones permitidas');
    }
    const existing = this.options.find(o => o.id === option.id);
    if (existing) return this;
    return new ModifierGroup({
      ...this.toProps(),
      options: [...this.options, option],
      updatedAt: new Date(),
    });
  }

  public removeOption(optionId: string): ModifierGroup {
    return new ModifierGroup({
      ...this.toProps(),
      options: this.options.filter(o => o.id !== optionId),
      updatedAt: new Date(),
    });
  }

  public updateOption(optionId: string, updater: (opt: ModifierOption) => ModifierOption): ModifierGroup {
    return new ModifierGroup({
      ...this.toProps(),
      options: this.options.map(o => o.id === optionId ? updater(o) : o),
      updatedAt: new Date(),
    });
  }

  public reorderOptions(optionIds: string[]): ModifierGroup {
    const ordered = optionIds.map((id, index) => {
      const opt = this.options.find(o => o.id === id);
      return opt ? ModifierOption.reconstitute({
        ...opt,
        displayOrder: index,
      }) : null;
    }).filter((o): o is ModifierOption => o !== null);
    
    // Add any remaining options not in the list
    const remaining = this.options.filter(o => !optionIds.includes(o.id));
    return new ModifierGroup({
      ...this.toProps(),
      options: [...ordered, ...remaining],
      updatedAt: new Date(),
    });
  }

  public activate(): ModifierGroup {
    return new ModifierGroup({ ...this.toProps(), isActive: true, updatedAt: new Date() });
  }

  public deactivate(): ModifierGroup {
    return new ModifierGroup({ ...this.toProps(), isActive: false, updatedAt: new Date() });
  }

  private toProps(): ModifierGroupProps {
    return {
      id: this.id,
      businessId: this.businessId,
      name: this.name,
      description: this.description,
      minSelection: this.minSelection,
      maxSelection: this.maxSelection,
      isRequired: this.isRequired,
      displayOrder: this.displayOrder,
      isActive: this.isActive,
      options: this.options,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}