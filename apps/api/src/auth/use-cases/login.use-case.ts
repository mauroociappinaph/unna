import { Inject, Injectable } from '@nestjs/common';
import { UserRepositoryPort, HashingPort, JwtPort } from '@unna/domain';
import { Email, Password } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';

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
    @Inject('JwtPort')
    private readonly jwtPort: JwtPort,
  ) {}

  async execute(command: LoginCommand): Promise<Result<{ user: any; tokens: any }, Error>> {
    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email.value);

    if (!user) {
      return err(new Error('Credenciales inválidas'));
    }

    if (!user.isActive) {
      return err(new Error('Cuenta desactivada'));
    }

    const password = Password.fromHash(user.password.hash);
    const isValid = await this.hashingPort.verify(command.password, password.hash);

    if (!isValid) {
      return err(new Error('Credenciales inválidas'));
    }

    user.recordLogin();
    await this.userRepository.save(user);

    const tokens = this.jwtPort.generateTokenPair({
      sub: user.id,
      email: user.email.value,
      role: user.roles[0],
      businessId: undefined,
    });

    return ok({ user, tokens });
  }
}