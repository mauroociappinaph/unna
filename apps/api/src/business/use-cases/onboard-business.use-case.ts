import { Inject, Injectable } from '@nestjs/common';
import { BusinessRepositoryPort } from '@unna/domain';
import { Business, BusinessName, CUIT, Address, Schedule, BusinessSettings, Sucursal } from '@unna/domain';
import { Result, ok, err } from '@unna/domain';

interface DayScheduleInput {
  open: string;
  close: string;
  isClosed: boolean;
}

interface WeekScheduleInput {
  monday: DayScheduleInput;
  tuesday: DayScheduleInput;
  wednesday: DayScheduleInput;
  thursday: DayScheduleInput;
  friday: DayScheduleInput;
  saturday: DayScheduleInput;
  sunday: DayScheduleInput;
}

interface AddressInput {
  street: string;
  number: string;
  floor?: string;
  apartment?: string;
  neighborhood?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

interface SettingsInput {
  tradeName: string;
  legalName?: string;
  ivaCondition: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';
  iibbNumber?: string;
  salePoint: string;
  currency: 'ARS' | 'USD';
  timezone: string;
  language: string;
  logoUrl?: string;
}

interface SucursalInput {
  name: string;
  address: AddressInput;
  phone: string;
  email: string;
  schedule?: WeekScheduleInput;
  isMain?: boolean;
}

export interface OnboardBusinessCommand {
  ownerId: string;
  businessName: string;
  cuit: string;
  address: AddressInput;
  schedule: WeekScheduleInput;
  settings: SettingsInput;
  sucursales: SucursalInput[];
}

@Injectable()
export class OnboardBusinessUseCase {
  constructor(
    @Inject('BusinessRepositoryPort')
    private readonly businessRepository: BusinessRepositoryPort,
  ) {}

  async execute(command: OnboardBusinessCommand): Promise<Result<Business, Error>> {
    const name = BusinessName.create(command.businessName);
    
    const existsByName = await this.businessRepository.existsByName(name.value);
    if (existsByName) {
      return err(new Error('Ya existe un negocio con ese nombre'));
    }

    const cuit = CUIT.create(command.cuit);
    const existsByCuit = await this.businessRepository.existsByCuit(cuit.value);
    if (existsByCuit) {
      return err(new Error('Ya existe un negocio con ese CUIT'));
    }

    const address = Address.create(command.address);
    const schedule = Schedule.create(command.schedule);
    const settings = BusinessSettings.create(command.settings);

    const sucursales = command.sucursales.map(s => 
      Sucursal.create({
        name: s.name,
        address: Address.create(s.address),
        phone: s.phone,
        email: s.email,
        schedule: s.schedule ? Schedule.create(s.schedule) : Schedule.createClosed(),
        isMain: s.isMain ?? false,
        isActive: true,
      })
    );

    const businessId = crypto.randomUUID();
    const business = Business.onboard(
      businessId,
      name,
      cuit,
      address,
      schedule,
      settings,
      command.ownerId,
      sucursales
    );

    await this.businessRepository.save(business);
    return ok(business);
  }
}