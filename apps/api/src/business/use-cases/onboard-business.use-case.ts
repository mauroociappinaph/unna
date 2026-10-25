import { Inject, Injectable } from '@nestjs/common';
import { BusinessRepositoryPort } from '@unna/domain';
import { Business, BusinessName } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';

export interface OnboardBusinessCommand {
  ownerId: string;
  businessName: string;
}

@Injectable()
export class OnboardBusinessUseCase {
  constructor(
    @Inject('BusinessRepositoryPort')
    private readonly businessRepository: BusinessRepositoryPort,
  ) {}

  async execute(command: OnboardBusinessCommand): Promise<Result<Business, Error>> {
    const name = BusinessName.create(command.businessName);
    const exists = await this.businessRepository.existsByName(name.value);
    if (exists) {
      return err(new Error('Ya existe un negocio con ese nombre'));
    }

    const businessId = crypto.randomUUID();
    const business = Business.create(businessId, name, command.ownerId);

    await this.businessRepository.save(business);
    return ok(business);
  }
}