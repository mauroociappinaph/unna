import { DomainEvent } from '../events/domain-event';
import { Email } from '../value-objects/email';

export class UserRegisteredEvent extends DomainEvent {
  public readonly userId: string;
  public readonly email: Email;
  public readonly businessName: string;

  constructor(userId: string, email: Email, businessName: string) {
    super();
    this.userId = userId;
    this.email = email;
    this.businessName = businessName;
  }

  public get eventName(): string {
    return 'UserRegistered';
  }
}

export class UserLoggedInEvent extends DomainEvent {
  public readonly userId: string;
  public readonly email: Email;

  constructor(userId: string, email: Email) {
    super();
    this.userId = userId;
    this.email = email;
  }

  public get eventName(): string {
    return 'UserLoggedIn';
  }
}

export class BusinessCreatedEvent extends DomainEvent {
  public readonly businessId: string;
  public readonly ownerId: string;
  public readonly businessName: string;

  constructor(businessId: string, ownerId: string, businessName: string) {
    super();
    this.businessId = businessId;
    this.ownerId = ownerId;
    this.businessName = businessName;
  }

  public get eventName(): string {
    return 'BusinessCreated';
  }
}