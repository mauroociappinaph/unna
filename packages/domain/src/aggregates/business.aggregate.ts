import { AggregateRoot } from './aggregate-root';
import { BusinessName } from '../value-objects/business-name';
import { CUIT } from '../value-objects/cuit';
import { Address } from '../value-objects/address';
import { Schedule } from '../value-objects/schedule';
import { BusinessSettings } from '../value-objects/business-settings';
import { Sucursal } from './sucursal.aggregate';
import { BusinessCreatedEvent, BusinessOnboardedEvent } from '../events/auth-events';

export interface BusinessProps {
  name: BusinessName;
  cuit: CUIT;
  address: Address;
  schedule: Schedule;
  settings: BusinessSettings;
  ownerId: string;
  slug: string;
  isActive: boolean;
  sucursales: Sucursal[];
  createdAt: Date;
  updatedAt: Date;
}

export class Business extends AggregateRoot<BusinessProps> {
  private constructor(id: string, props: BusinessProps) {
    super(id, props);
  }

  public static create(
    id: string,
    name: BusinessName,
    cuit: CUIT,
    address: Address,
    schedule: Schedule,
    settings: BusinessSettings,
    ownerId: string
  ): Business {
    const now = new Date();
    const slug = Business.generateSlug(name.value);

    const business = new Business(id, {
      name,
      cuit,
      address,
      schedule,
      settings,
      ownerId,
      slug,
      isActive: true,
      sucursales: [],
      createdAt: now,
      updatedAt: now,
    });

    business.addDomainEvent(new BusinessCreatedEvent(id, ownerId, name.value));
    return business;
  }

  public static onboard(
    id: string,
    name: BusinessName,
    cuit: CUIT,
    address: Address,
    schedule: Schedule,
    settings: BusinessSettings,
    ownerId: string,
    sucursales: Omit<Sucursal, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Business {
    const now = new Date();
    const slug = Business.generateSlug(name.value);

    const createdSucursales = sucursales.map((s, index) => 
      Sucursal.create({ ...s, isMain: index === 0 })
    );

    // Validate at least one main sucursal
    const mainCount = createdSucursales.filter(s => s.isMain).length;
    if (mainCount === 0 && createdSucursales.length > 0) {
      createdSucursales[0] = createdSucursales[0].setAsMain();
    }

    const business = new Business(id, {
      name,
      cuit,
      address,
      schedule,
      settings,
      ownerId,
      slug,
      isActive: true,
      sucursales: createdSucursales,
      createdAt: now,
      updatedAt: now,
    });

    business.addDomainEvent(new BusinessOnboardedEvent(id, ownerId, name.value, createdSucursales.length));
    return business;
  }

  public static reconstitute(id: string, props: BusinessProps): Business {
    return new Business(id, props);
  }

  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 50);
  }

  public get name(): BusinessName {
    return this.props.name;
  }

  public get cuit(): CUIT {
    return this.props.cuit;
  }

  public get address(): Address {
    return this.props.address;
  }

  public get schedule(): Schedule {
    return this.props.schedule;
  }

  public get settings(): BusinessSettings {
    return this.props.settings;
  }

  public get ownerId(): string {
    return this.props.ownerId;
  }

  public get slug(): string {
    return this.props.slug;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public get sucursales(): Sucursal[] {
    return this.props.sucursales;
  }

  public get mainSucursal(): Sucursal | undefined {
    return this.props.sucursales.find(s => s.isMain);
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public updateName(newName: BusinessName): void {
    this.props.name = newName;
    this.props.slug = Business.generateSlug(newName.value);
    this.props.updatedAt = new Date();
  }

  public updateCuit(newCuit: CUIT): void {
    this.props.cuit = newCuit;
    this.props.updatedAt = new Date();
  }

  public updateAddress(newAddress: Address): void {
    this.props.address = newAddress;
    this.props.updatedAt = new Date();
  }

  public updateSchedule(newSchedule: Schedule): void {
    this.props.schedule = newSchedule;
    this.props.updatedAt = new Date();
  }

  public updateSettings(settings: Partial<BusinessSettings>): void {
    this.props.settings = this.props.settings.update(settings);
    this.props.updatedAt = new Date();
  }

  public addSucursal(sucursal: Sucursal): void {
    // If this is the first sucursal, make it main
    if (this.props.sucursales.length === 0) {
      sucursal = sucursal.setAsMain();
    }
    this.props.sucursales.push(sucursal);
    this.props.updatedAt = new Date();
  }

  public removeSucursal(sucursalId: string): void {
    const index = this.props.sucursales.findIndex(s => s.id === sucursalId);
    if (index !== -1) {
      const wasMain = this.props.sucursales[index].isMain;
      this.props.sucursales.splice(index, 1);
      // If we removed the main, promote another
      if (wasMain && this.props.sucursales.length > 0) {
        this.props.sucursales[0] = this.props.sucursales[0].setAsMain();
      }
      this.props.updatedAt = new Date();
    }
  }

  public updateSucursal(sucursalId: string, updater: (s: Sucursal) => Sucursal): void {
    const index = this.props.sucursales.findIndex(s => s.id === sucursalId);
    if (index !== -1) {
      this.props.sucursales[index] = updater(this.props.sucursales[index]);
      this.props.updatedAt = new Date();
    }
  }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  protected validate(): void {
    if (!this.props.name) throw new Error('Business name is required');
    if (!this.props.ownerId) throw new Error('Owner ID is required');
    if (!this.props.cuit) throw new Error('CUIT is required');
    if (!this.props.address) throw new Error('Address is required');
    if (!this.props.schedule) throw new Error('Schedule is required');
    if (!this.props.settings) throw new Error('Settings is required');
  }
}