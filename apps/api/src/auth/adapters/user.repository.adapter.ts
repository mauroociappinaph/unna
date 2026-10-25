import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepositoryPort } from '@unna/domain';
import { User } from '@unna/domain';
import { Email } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';

@Injectable()
export class PrismaUserRepositoryAdapter implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    const props = this.toPrisma(user);
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: props,
      update: props,
    });
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? this.toDomain(record) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  private toPrisma(user: User): any {
    return {
      id: user.id,
      email: user.email.value,
      passwordHash: user.password.hash,
      name: user.name.value,
      phone: user.phone.value,
      businessName: user.businessName,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      roles: user.roles,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toDomain(record: any): User {
    return User.reconstitute(record.id, {
      email: Email.create(record.email),
      password: require('@unna/domain').Password.fromHash(record.passwordHash),
      name: require('@unna/domain').PersonName.create(record.name),
      phone: require('@unna/domain').Phone.create(record.phone),
      businessName: record.businessName,
      isActive: record.isActive,
      emailVerified: record.emailVerified,
      roles: record.roles,
      lastLoginAt: record.lastLoginAt ? new Date(record.lastLoginAt) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }
}