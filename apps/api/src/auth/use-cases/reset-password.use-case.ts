import { Inject, Injectable } from '@nestjs/common';
import { UserRepositoryPort, JwtPort, HashingPort, ResetTokenPayload } from '@unna/domain';
import { Password } from '@unna/domain';
import { NotFoundError, Result, ok, err } from '@unna/domain';
import { passwordFingerprint } from '../session-token';

const RESET_LINK_SPENT = 'El link ya se usó o venció. Pedí uno nuevo.';

export interface ResetPasswordCommand {
  token: string;
  password: string;
  confirmPassword: string;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
    @Inject('JwtPort')
    private readonly jwtPort: JwtPort,
    @Inject('HashingPort')
    private readonly hashingPort: HashingPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<Result<void, Error>> {
    if (command.password !== command.confirmPassword) {
      return err(new Error('Las contraseñas no coinciden.'));
    }

    let payload: ResetTokenPayload;
    try {
      payload = this.jwtPort.verifyResetToken(command.token);
    } catch {
      return err(new Error('Token inválido o expirado.'));
    }

    if (payload.type !== 'password_reset') {
      return err(new Error('Token inválido.'));
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      return err(new NotFoundError('Usuario no encontrado.'));
    }

    if (user.email.value !== payload.email) {
      return err(new Error('Token inválido.'));
    }

    // The link carries the fingerprint of the password it was issued for: once the password
    // changed (with this link or another one) every earlier link is spent.
    if (payload.pwd !== passwordFingerprint(user.password.hash)) {
      return err(new Error(RESET_LINK_SPENT));
    }

    const password = Password.create(command.password);
    const hashedPassword = await this.hashingPort.hash(password.value);
    const passwordWithHash = password.setHashed(hashedPassword);

    user.changePassword(passwordWithHash);
    await this.userRepository.save(user);

    return ok(undefined);
  }
}