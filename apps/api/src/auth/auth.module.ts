import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { RegisterUseCase } from './use-cases/register.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { ForgotPasswordUseCase } from './use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';
import { AuthController } from './auth.controller';
import { JwtAdapter } from './adapters/jwt.adapter';
import { BcryptHashingAdapter } from './adapters/hashing.adapter';
import { PrismaUserRepositoryAdapter } from './adapters/user.repository.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from '../common/strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') || '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    JwtStrategy,
    {
      provide: 'UserRepositoryPort',
      useClass: PrismaUserRepositoryAdapter,
    },
    {
      provide: 'HashingPort',
      useClass: BcryptHashingAdapter,
    },
    {
      provide: 'JwtPort',
      useClass: JwtAdapter,
    },
  ],
  exports: [RegisterUseCase, LoginUseCase, ForgotPasswordUseCase, ResetPasswordUseCase, 'UserRepositoryPort', 'HashingPort', 'JwtPort'],
})
export class AuthModule {}