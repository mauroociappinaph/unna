import { Inject, Injectable } from '@nestjs/common';
import { UserRepositoryPort, HashingPort, TokenPair } from '@unna/domain';
import { User } from '@unna/domain';
import { Email, Password, PersonName, Phone, BusinessName } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';
import { SessionIssuer } from '../session-issuer';

export interface RegisterCommand {
  email: string;
  password: string;
  name: string;
  phone: string;
  businessName: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
    @Inject('HashingPort')
    private readonly hashingPort: HashingPort,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(command: RegisterCommand): Promise<Result<{ user: User; tokens: TokenPair }, Error>> {
    const email = Email.create(command.email);
    const exists = await this.userRepository.existsByEmail(email.value);
    if (exists) {
      return err(new Error('El email ya está registrado'));
    }

    const password = Password.create(command.password);
    const hashedPassword = await this.hashingPort.hash(password.value);
    const passwordWithHash = password.setHashed(hashedPassword);

    const name = PersonName.create(command.name);
    const cleanPhone = command.phone.replace(/\D/g, '');
    const phone = Phone.create(cleanPhone);
    const businessNameVO = BusinessName.create(command.businessName);

    const userId = crypto.randomUUID();
    const user = User.create(userId, email, passwordWithHash, name, phone, businessNameVO.value);

    await this.userRepository.save(user);

    const tokens = await this.sessionIssuer.start(user);

    return ok({ user, tokens });
  }
}