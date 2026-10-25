import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterUseCase, RegisterCommand } from './use-cases/register.use-case';
import { LoginUseCase, LoginCommand } from './use-cases/login.use-case';
import { ForgotPasswordUseCase, ForgotPasswordCommand } from './use-cases/forgot-password.use-case';
import { ResetPasswordUseCase, ResetPasswordCommand } from './use-cases/reset-password.use-case';
import { VerifyEmailUseCase, VerifyEmailCommand } from './use-cases/verify-email.use-case';
import { Result, isOk, isErr } from '@unna/domain';
import { IsString, IsEmail, MinLength, MaxLength, Matches, IsBoolean, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'PasswordsMatch', async: false })
export class PasswordsMatchConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    const obj = args.object as any;
    return obj.password === confirmPassword;
  }
  defaultMessage() { return 'Las contraseñas no coinciden.'; }
}

@ValidatorConstraint({ name: 'AcceptTermsTrue', async: false })
export class AcceptTermsTrueConstraint implements ValidatorConstraintInterface {
  validate(acceptTerms: boolean) {
    return acceptTerms === true;
  }
  defaultMessage() { return 'Debes aceptar las Condiciones y Políticas.'; }
}

export class RegisterDto implements RegisterCommand {
  @IsString()
  @MinLength(3, { message: 'El nombre del negocio debe tener más de 3 caracteres.' })
  @MaxLength(45, { message: 'El nombre del negocio debe tener menos de 45 caracteres.' })
  @Matches(/^[a-zA-Z0-9\s&_\-]+$/, { message: 'Solamente caracteres alfanuméricos y los símbolos: &, - y _.' })
  businessName!: string;

  @IsString()
  @MinLength(3, { message: 'Tu nombre debe tener más de 3 caracteres.' })
  @MaxLength(45, { message: 'Tu nombre debe tener menos de 45 caracteres.' })
  name!: string;

  @IsString()
  @MinLength(1, { message: 'Este campo es obligatorio' })
  @Matches(/^[\d\s\-()]+$/, { message: 'Ingresá un teléfono válido. Ej.: 11 1234 5678' })
  phone!: string;

  @IsEmail({}, { message: 'Ingresá un e-mail válido. Ej.: nombre@gmail.com' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  @Matches(/[A-Z]/, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  @Matches(/[a-z]/, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  @Matches(/[0-9]/, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  password!: string;

  @IsString()
  @MinLength(1, { message: 'Este campo es obligatorio' })
  @Validate(PasswordsMatchConstraint)
  confirmPassword!: string;

  @IsBoolean()
  @Validate(AcceptTermsTrueConstraint)
  acceptTerms!: boolean;
}

export class LoginDto implements LoginCommand {
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Contraseña es obligatoria' })
  password!: string;
}

export class ForgotPasswordDto implements ForgotPasswordCommand {
  @IsEmail({}, { message: 'Ingresá un e-mail válido. Ej.: nombre@gmail.com' })
  email!: string;
}

export class ResetPasswordDto implements ResetPasswordCommand {
  @IsString()
  @MinLength(1, { message: 'Token es obligatorio' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  @Matches(/[A-Z]/, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  @Matches(/[a-z]/, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  @Matches(/[0-9]/, { message: 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.' })
  password!: string;

  @IsString()
  @MinLength(1, { message: 'Este campo es obligatorio' })
  @Validate(PasswordsMatchConstraint)
  confirmPassword!: string;
}

export class VerifyEmailDto implements VerifyEmailCommand {
  @IsString()
  @MinLength(1, { message: 'Token es obligatorio' })
  token!: string;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: {
    id: string;
    email: string;
    name: string;
    businessName: string;
  };
}

export class MessageResponseDto {
  message!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Registrar nuevo usuario y negocio' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.registerUseCase.execute(dto);
    return this.handleResult(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.loginUseCase.execute(dto);
    return this.handleResult(result);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const result = await this.forgotPasswordUseCase.execute(dto);
    if (isErr(result)) {
      const { HttpException } = require('@nestjs/common');
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }
    return { message: 'Si el email existe, recibirás un link para restablecer tu contraseña.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Token inválido o contraseñas no coinciden' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const result = await this.resetPasswordUseCase.execute(dto);
    if (isErr(result)) {
      const { HttpException } = require('@nestjs/common');
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }
    return { message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión.' };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Verificar email con token' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    const result = await this.verifyEmailUseCase.execute(dto);
    if (isErr(result)) {
      const { HttpException } = require('@nestjs/common');
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }
    return { message: 'Email verificado correctamente. Ya podés iniciar sesión.' };
  }

  private handleResult<T extends { user: any; tokens: any }>(result: Result<T, Error>): AuthResponseDto {
    if (isOk(result)) {
      const { user, tokens } = result.value;
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          email: user.email.value,
          name: user.name.value,
          businessName: user.businessName,
        },
      };
    }
    const error = result.error;
    const statusCode = error.message.includes('ya está registrado') ? HttpStatus.CONFLICT :
                       error.message.includes('inválidas') || error.message.includes('desactivada') ? HttpStatus.UNAUTHORIZED :
                       HttpStatus.BAD_REQUEST;

    const { HttpException } = require('@nestjs/common');
    throw new HttpException(error.message, statusCode);
  }
}