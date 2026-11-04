import { Inject, Injectable, Logger } from '@nestjs/common';
import { UserRepositoryPort, JwtPort, EmailPort } from '@unna/domain';
import { Email } from '@unna/domain';
import { Result, ok } from '@unna/domain';
import { frontendUrl } from '../../common/frontend-url';
import { passwordFingerprint } from '../session-token';

export interface ForgotPasswordCommand {
  email: string;
}

@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
    @Inject('JwtPort')
    private readonly jwtPort: JwtPort,
    @Inject('EmailPort')
    private readonly emailPort: EmailPort,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<Result<void, Error>> {
    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email.value);

    if (!user) {
      return ok(undefined);
    }

    const resetToken = this.jwtPort.generateResetToken({
      sub: user.id,
      email: user.email.value,
      type: 'password_reset',
      pwd: passwordFingerprint(user.password.hash),
    });

    const resetLink = `${frontendUrl()}/recuperar-contrasena?token=${resetToken}`;

    // Not awaited: waiting for the mail provider only when the account exists would let the
    // response time tell which emails are registered. A failed send is logged, never answered.
    void this.sendResetEmail(user.email.value, resetLink);

    return ok(undefined);
  }

  private async sendResetEmail(to: string, resetLink: string): Promise<void> {
    try {
      await this.emailPort.sendPasswordResetEmail(to, resetLink);
    } catch (error) {
      this.logger.error(`No se pudo enviar el mail de recuperación: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}