import { AggregateRoot } from './aggregate-root';
import { BusinessName } from '../value-objects/business-name';
import { BusinessCreatedEvent } from '../events/auth-events';

export interface BusinessProps {
  name: BusinessName;
  ownerId: string;
  slug: string;
  isActive: boolean;
  settings: BusinessSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessSettings {
  timezone: string;
  currency: string;
  language: string;
}

export class Business extends AggregateRoot<BusinessProps> {
  private constructor(id: string, props: BusinessProps) {
    super(id, props);
  }

  public static create(
    id: string,
    name: BusinessName,
    ownerId: string
  ): Business {
    const now = new Date();
    const slug = Business.generateSlug(name.value);

    const business = new Business(id, {
      name,
      ownerId,
      slug,
      isActive: true,
      settings: {
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        language: 'es-AR',
      },
      createdAt: now,
      updatedAt: now,
    });

    business.addDomainEvent(new BusinessCreatedEvent(id, ownerId, name.value));
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

  public get ownerId(): string {
    return this.props.ownerId;
  }

  public get slug(): string {
    return this.props.slug;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public get settings(): BusinessSettings {
    return this.props.settings;
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

  public updateSettings(settings: Partial<BusinessSettings>): void {
    this.props.settings = { ...this.props.settings, ...settings };
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  protected validate(): void {
    if (!this.props.name) throw new Error('Business name is required');
    if (!this.props.ownerId) throw new Error('Owner ID is required');
  }
}