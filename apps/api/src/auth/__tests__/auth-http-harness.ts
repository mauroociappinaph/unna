import { Controller, Get, INestApplication, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import { EmailPort, HashingPort, User, UserRepositoryPort } from '@unna/domain';
import { AuthController } from '../auth.controller';
import { JwtAdapter } from '../adapters/jwt.adapter';
import { ForgotPasswordUseCase } from '../use-cases/forgot-password.use-case';
import { LoginUseCase } from '../use-cases/login.use-case';
import { RefreshSessionUseCase } from '../use-cases/refresh-session.use-case';
import { RegisterUseCase } from '../use-cases/register.use-case';
import { ResetPasswordUseCase } from '../use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from '../use-cases/verify-email.use-case';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { configureApp } from '../../app-setup';

export const SECRETS = {
  JWT_SECRET: 'access-secret-for-tests-0123456789abcdef',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests-0123456789abcdef',
  JWT_RESET_SECRET: 'reset-secret-for-tests-0123456789abcdef',
};

export const OWNER = {
  businessName: 'Mi Restaurante',
  name: 'Juan Perez',
  phone: '1112345678',
  email: 'owner@unna.test',
  password: 'SecurePass123',
  confirmPassword: 'SecurePass123',
  acceptTerms: true,
};

/** Users kept in memory, saved like the Prisma adapter does (by id, last write wins). */
export class InMemoryUsers implements UserRepositoryPort {
  readonly byId = new Map<string, User>();
  async save(user: User): Promise<void> {
    this.byId.set(user.id, user);
  }
  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    return [...this.byId.values()].find((user) => user.email.value === email) ?? null;
  }
  async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }
  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}

/** Fast stand-in for bcrypt: the hash is the password with a prefix. */
export const fakeHashing: HashingPort = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async (plain, hashed) => hashed === `hashed:${plain}`,
};

export class CapturedEmails implements EmailPort {
  readonly resetLinks: string[] = [];
  async sendEmail(): Promise<void> {}
  async sendPasswordResetEmail(_to: string, resetLink: string): Promise<void> {
    this.resetLinks.push(resetLink);
  }
  async sendEmailVerificationEmail(): Promise<void> {}
}

@Controller('me')
class MeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return req.user;
  }
}

export interface AuthApp {
  app: INestApplication;
  users: InMemoryUsers;
  emails: CapturedEmails;
  jwt: JwtAdapter;
}

/** The real auth controller, use cases, JWT adapter and strategy over in-memory users. */
export async function startAuthApp(env: NodeJS.ProcessEnv = { NODE_ENV: 'test', ...SECRETS }): Promise<AuthApp> {
  const users = new InMemoryUsers();
  const emails = new CapturedEmails();
  const moduleRef = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
    controllers: [AuthController, MeController],
    providers: [
      RegisterUseCase,
      LoginUseCase,
      ForgotPasswordUseCase,
      ResetPasswordUseCase,
      VerifyEmailUseCase,
      RefreshSessionUseCase,
      JwtStrategy,
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
      { provide: 'UserRepositoryPort', useValue: users },
      { provide: 'HashingPort', useValue: fakeHashing },
      { provide: 'EmailPort', useValue: emails },
      { provide: 'JwtPort', useClass: JwtAdapter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, env);
  await app.init();
  return { app, users, emails, jwt: moduleRef.get('JwtPort') };
}

export const tokenFromLink = (link: string): string => new URL(link).searchParams.get('token') ?? '';
