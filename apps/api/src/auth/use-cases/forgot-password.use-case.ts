import { Inject, Injectable } from '@nestjs/common';
import { UserRepositoryPort, JwtPort, EmailPort } from '@unna/domain';
import { Email } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';

export interface ForgotPasswordCommand {
  email: string;
}

@Injectable()
export class ForgotPasswordUseCase {
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
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/recuperar-contrasena?token=${resetToken}`;

    await this.emailPort.sendPasswordResetEmail(user.email.value, resetLink);

    return ok(undefined);
  }
}