import { Schedule } from '../value-objects/schedule';
import { Address } from '../value-objects/address';

export interface SucursalProps {
  id: string;
  name: string;
  address: Address;
  phone: string;
  email: string;
  schedule: Schedule;
  isMain: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Sucursal {
  public readonly id: string;
  public readonly name: string;
  public readonly address: Address;
  public readonly phone: string;
  public readonly email: string;
  public readonly schedule: Schedule;
  public readonly isMain: boolean;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: SucursalProps) {
    this.id = props.id;
    this.name = props.name;
    this.address = props.address;
    this.phone = props.phone;
    this.email = props.email;
    this.schedule = props.schedule;
    this.isMain = props.isMain;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<SucursalProps, 'id' | 'createdAt' | 'updatedAt'>): Sucursal {
    if (!props.name || !props.name.trim()) {
      throw new Error('Nombre de sucursal es obligatorio');
    }
    if (props.name.length > 100) {
      throw new Error('Nombre de sucursal no puede exceder 100 caracteres');
    }
    if (!props.phone || !props.phone.trim()) {
      throw new Error('Teléfono de sucursal es obligatorio');
    }
    if (!props.email || !props.email.trim()) {
      throw new Error('Email de sucursal es obligatorio');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new Error('Email de sucursal inválido');
    }

    const now = new Date();
    return new Sucursal({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: SucursalProps): Sucursal {
    return new Sucursal(props);
  }

  public updateName(name: string): Sucursal {
    if (!name || !name.trim()) {
      throw new Error('Nombre de sucursal es obligatorio');
    }
    return new Sucursal({ ...this.toProps(), name: name.trim(), updatedAt: new Date() });
  }

  public updateAddress(address: Address): Sucursal {
    return new Sucursal({ ...this.toProps(), address, updatedAt: new Date() });
  }

  public updatePhone(phone: string): Sucursal {
    if (!phone || !phone.trim()) {
      throw new Error('Teléfono de sucursal es obligatorio');
    }
    return new Sucursal({ ...this.toProps(), phone: phone.trim(), updatedAt: new Date() });
  }

  public updateEmail(email: string): Sucursal {
    if (!email || !email.trim()) {
      throw new Error('Email de sucursal es obligatorio');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email de sucursal inválido');
    }
    return new Sucursal({ ...this.toProps(), email: email.trim(), updatedAt: new Date() });
  }

  public updateSchedule(schedule: Schedule): Sucursal {
    return new Sucursal({ ...this.toProps(), schedule, updatedAt: new Date() });
  }

  public setAsMain(): Sucursal {
    return new Sucursal({ ...this.toProps(), isMain: true, updatedAt: new Date() });
  }

  public unsetAsMain(): Sucursal {
    return new Sucursal({ ...this.toProps(), isMain: false, updatedAt: new Date() });
  }

  public activate(): Sucursal {
    return new Sucursal({ ...this.toProps(), isActive: true, updatedAt: new Date() });
  }

  public deactivate(): Sucursal {
    return new Sucursal({ ...this.toProps(), isActive: false, updatedAt: new Date() });
  }

  private toProps(): SucursalProps {
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      phone: this.phone,
      email: this.email,
      schedule: this.schedule,
      isMain: this.isMain,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  public equals(other: Sucursal): boolean {
    return this.id === other.id;
  }
}