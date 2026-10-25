import { AggregateRoot } from './aggregate-root';
import { Email } from '../value-objects/email';
import { Password } from '../value-objects/password';
import { PersonName } from '../value-objects/person-name';
import { Phone } from '../value-objects/phone';
import { UserRegisteredEvent, UserLoggedInEvent } from '../events/auth-events';

export interface UserProps {
  email: Email;
  password: Password;
  name: PersonName;
  phone: Phone;
  businessName: string;
  isActive: boolean;
  emailVerified: boolean;
  roles: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<UserProps> {
  private constructor(id: string, props: UserProps) {
    super(id, props);
  }

  public static create(
    id: string,
    email: Email,
    password: Password,
    name: PersonName,
    phone: Phone,
    businessName: string
  ): User {
    const now = new Date();
    const user = new User(id, {
      email,
      password,
      name,
      phone,
      businessName,
      isActive: true,
      emailVerified: false,
      roles: ['owner'],
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    user.addDomainEvent(new UserRegisteredEvent(id, email, businessName));
    return user;
  }

  public static reconstitute(id: string, props: UserProps): User {
    return new User(id, props);
  }

  public get email(): Email {
    return this.props.email;
  }

  public get password(): Password {
    return this.props.password;
  }

  public get name(): PersonName {
    return this.props.name;
  }

  public get phone(): Phone {
    return this.props.phone;
  }

  public get businessName(): string {
    return this.props.businessName;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public get roles(): string[] {
    return this.props.roles;
  }

  public get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  public get emailVerified(): boolean {
    return this.props.emailVerified;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public recordLogin(): void {
    this.props.lastLoginAt = new Date();
    this.props.updatedAt = new Date();
    this.addDomainEvent(new UserLoggedInEvent(this.id, this.props.email));
  }

  public changePassword(newPassword: Password): void {
    this.props.password = newPassword;
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  public verifyEmail(): void {
    this.props.emailVerified = true;
    this.props.updatedAt = new Date();
  }

  protected validate(): void {
    if (!this.props.email) throw new Error('Email is required');
    if (!this.props.password) throw new Error('Password is required');
    if (!this.props.name) throw new Error('Name is required');
    if (!this.props.phone) throw new Error('Phone is required');
  }
}