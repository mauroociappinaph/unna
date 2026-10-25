import { Inject, Injectable } from '@nestjs/common';
import { UserRepositoryPort, JwtPort, EmailPort } from '@unna/domain';
import { Email } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';

export interface VerifyEmailCommand {
  token: string;
}

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
    @Inject('JwtPort')
    private readonly jwtPort: JwtPort,
    @Inject('EmailPort')
    private readonly emailPort: EmailPort,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<Result<void, Error>> {
    let payload: { sub: string; email: string; type: string };
    try {
      payload = this.jwtPort.verifyResetToken(command.token);
    } catch {
      return err(new Error('Token inválido o expirado.'));
    }

    if (payload.type !== 'email_verification') {
      return err(new Error('Token inválido.'));
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      return err(new Error('Usuario no encontrado.'));
    }

    if (user.email.value !== payload.email) {
      return err(new Error('Token inválido.'));
    }

    user.verifyEmail();
    await this.userRepository.save(user);

    return ok(undefined);
  }
}