import { Inject, Injectable } from '@nestjs/common';
import { UserRepositoryPort, HashingPort, TokenPair, User } from '@unna/domain';
import { Email } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';
import { SessionIssuer } from '../session-issuer';

/** bcrypt hash (cost 12, like BcryptHashingAdapter) of a random password nobody uses. */
const DUMMY_PASSWORD_HASH = '$2b$12$zVTwEOg5y0FX3TqxpPX.Pu2K0PlxkMcAh9xS72cgztDkGHOmoRAGe';

export interface LoginCommand {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
    @Inject('HashingPort')
    private readonly hashingPort: HashingPort,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(command: LoginCommand): Promise<Result<{ user: User; tokens: TokenPair }, Error>> {
    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email.value);

    // Same work and the same answer with or without an account, so neither the timing nor the
    // message tells whether the email is registered; a deactivated account is only revealed to
    // whoever knows its password.
    const isValid = await this.hashingPort.verify(command.password, user ? user.password.hash : DUMMY_PASSWORD_HASH);

    if (!user || !isValid) {
      return err(new Error('Credenciales inválidas'));
    }

    if (!user.isActive) {
      return err(new Error('Cuenta desactivada'));
    }

    user.recordLogin();
    await this.userRepository.save(user);

    const tokens = await this.sessionIssuer.start(user);

    return ok({ user, tokens });
  }
}
