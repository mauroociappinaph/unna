import { AggregateRoot } from './aggregate-root';
import { Email } from '../value-objects/email';
import { Password } from '../value-objects/password';
import { PersonName } from '../value-objects/person-name';
import { Phone } from '../value-objects/phone';
import { UserRole, USER_ROLES, ROLE_HIERARCHY, hasRole, canManageRole } from '../value-objects/role';
import { UserRegisteredEvent, UserLoggedInEvent } from '../events/auth-events';

export interface UserProps {
  email: Email;
  password: Password;
  name: PersonName;
  phone: Phone;
  businessName: string;
  isActive: boolean;
  emailVerified: boolean;
  roles: UserRole[];
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

  public get roles(): UserRole[] {
    return this.props.roles as UserRole[];
  }

  public get highestRole(): UserRole {
    return this.props.roles.reduce((highest: UserRole, role: UserRole) =>
      ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highest] ? role : highest
    );
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

  public addRole(role: UserRole): void {
    if (!USER_ROLES.includes(role)) {
      throw new Error(`Rol inválido: ${role}`);
    }
    if (!this.props.roles.includes(role)) {
      this.props.roles.push(role);
      this.props.updatedAt = new Date();
    }
  }

  public removeRole(role: UserRole): void {
    const index = this.props.roles.indexOf(role);
    if (index !== -1) {
      this.props.roles.splice(index, 1);
      this.props.updatedAt = new Date();
    }
  }

  public hasRole(requiredRole: UserRole): boolean {
    return hasRole(this.props.roles as UserRole[], requiredRole);
  }

  public canManage(targetRole: UserRole): boolean {
    return canManageRole(this.props.roles as UserRole[], targetRole);
  }

  protected validate(): void {
    if (!this.props.email) throw new Error('Email is required');
    if (!this.props.password) throw new Error('Password is required');
    if (!this.props.name) throw new Error('Name is required');
    if (!this.props.phone) throw new Error('Phone is required');
  }
}