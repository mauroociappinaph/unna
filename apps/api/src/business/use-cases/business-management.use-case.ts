import { Inject, Injectable } from '@nestjs/common';
import { BusinessRepositoryPort } from '@unna/domain';
import { Business, Address, Schedule, Sucursal } from '@unna/domain';
import { NotFoundError, Result, ok, err } from '@unna/domain';

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

interface UpdateSucursalInput {
  id: string;
  name?: string;
  address?: AddressInput;
  phone?: string;
  email?: string;
  schedule?: WeekScheduleInput;
  isMain?: boolean;
  isActive?: boolean;
}

export interface UpdateBusinessSettingsCommand {
  businessId: string;
  ownerId: string;
  settings: Partial<SettingsInput>;
}

export interface ManageSucursalCommand {
  businessId: string;
  ownerId: string;
  action: 'create' | 'update' | 'delete';
  sucursal: SucursalInput | UpdateSucursalInput;
}

export interface ManageHorariosCommand {
  businessId: string;
  ownerId: string;
  sucursalId: string | 'main'; // 'main' = business-level schedule
  schedule: WeekScheduleInput;
}

export const SUCURSAL_NOT_FOUND = 'Sucursal no encontrada';

@Injectable()
export class BusinessManagementUseCase {
  constructor(
    @Inject('BusinessRepositoryPort')
    private readonly businessRepository: BusinessRepositoryPort,
  ) {}

  async listMine(ownerId: string): Promise<Business[]> {
    return this.businessRepository.findByOwnerId(ownerId);
  }

  /** Another owner's business is reported as not found, so ids do not leak. */
  async getMine(businessId: string, ownerId: string): Promise<Result<Business, Error>> {
    const business = await this.businessRepository.findById(businessId);
    if (!business || business.ownerId !== ownerId) return err(new NotFoundError('Negocio no encontrado'));
    return ok(business);
  }

  // Update business-level settings
  async updateSettings(command: UpdateBusinessSettingsCommand): Promise<Result<Business, Error>> {
    return this.edit(command, (business) => {
      const currentSettings = business.settings;
      const updates: Partial<SettingsInput> = command.settings;

      const updatedSettings = currentSettings.update({
        tradeName: updates.tradeName,
        legalName: updates.legalName,
        ivaCondition: updates.ivaCondition,
        iibbNumber: updates.iibbNumber,
        salePoint: updates.salePoint,
        currency: updates.currency,
        timezone: updates.timezone,
        language: updates.language,
        logoUrl: updates.logoUrl,
      });

      business.updateSettings({
        tradeName: updatedSettings.tradeName,
        legalName: updatedSettings.legalName,
        ivaCondition: updatedSettings.ivaCondition,
        iibbNumber: updatedSettings.iibbNumber,
        salePoint: updatedSettings.salePoint,
        currency: updatedSettings.currency,
        timezone: updatedSettings.timezone,
        language: updatedSettings.language,
        logoUrl: updatedSettings.logoUrl,
      });
      return ok(business);
    });
  }

  // Update business-level address
  async updateAddress(command: {
    businessId: string;
    ownerId: string;
    address: AddressInput;
  }): Promise<Result<Business, Error>> {
    return this.edit(command, (business) => {
      business.updateAddress(Address.create(command.address));
      return ok(business);
    });
  }

  // Update business-level schedule
  async updateSchedule(command: {
    businessId: string;
    ownerId: string;
    schedule: WeekScheduleInput;
  }): Promise<Result<Business, Error>> {
    return this.edit(command, (business) => {
      business.updateSchedule(Schedule.create(command.schedule));
      return ok(business);
    });
  }

  // Sucursal management
  async manageSucursal(command: ManageSucursalCommand): Promise<Result<Business, Error>> {
    return this.edit(command, (business) => {
      const { action, sucursal } = command;

      if (action === 'create') {
        const createInput = sucursal as SucursalInput;
        const newSucursal = Sucursal.create({
          name: createInput.name,
          address: Address.create(createInput.address),
          phone: createInput.phone,
          email: createInput.email,
          schedule: createInput.schedule ? Schedule.create(createInput.schedule) : Schedule.createClosed(),
          isMain: createInput.isMain ?? false,
          isActive: true,
        });
        business.addSucursal(newSucursal);
      } else if (action === 'update') {
        const updateInput = sucursal as UpdateSucursalInput;
        if (!updateInput.id) {
          return err(new Error('ID de sucursal requerido para actualizar'));
        }
        business.updateSucursal(updateInput.id, (s) => {
          if (updateInput.name !== undefined) s = s.updateName(updateInput.name);
          if (updateInput.address !== undefined) s = s.updateAddress(Address.create(updateInput.address));
          if (updateInput.phone !== undefined) s = s.updatePhone(updateInput.phone);
          if (updateInput.email !== undefined) s = s.updateEmail(updateInput.email);
          if (updateInput.schedule !== undefined) s = s.updateSchedule(Schedule.create(updateInput.schedule));
          if (updateInput.isMain !== undefined && updateInput.isMain) s = s.setAsMain();
          if (updateInput.isMain !== undefined && !updateInput.isMain) s = s.unsetAsMain();
          if (updateInput.isActive !== undefined) {
            s = updateInput.isActive ? s.activate() : s.deactivate();
          }
          return s;
        });
      } else if (action === 'delete') {
        const deleteInput = sucursal as UpdateSucursalInput;
        if (!deleteInput.id) {
          return err(new Error('ID de sucursal requerido para eliminar'));
        }
        if (!business.sucursales.some((s) => s.id === deleteInput.id)) {
          return err(new NotFoundError(SUCURSAL_NOT_FOUND));
        }
        business.removeSucursal(deleteInput.id);
      }

      return ok(business);
    });
  }

  // Schedule management (business or sucursal level)
  async manageHorarios(command: ManageHorariosCommand): Promise<Result<Business, Error>> {
    return this.edit(command, (business) => {
      const schedule = Schedule.create(command.schedule);

      if (command.sucursalId === 'main') {
        business.updateSchedule(schedule);
      } else {
        const sucursal = business.sucursales.find(s => s.id === command.sucursalId);
        if (!sucursal) return err(new NotFoundError('Sucursal no encontrada'));
        business.updateSucursal(command.sucursalId, (s) => s.updateSchedule(schedule));
      }

      return ok(business);
    });
  }

  /**
   * Applies an edit under the business lock, so concurrent edits do not overwrite each other, and
   * saves only when it succeeds. Another owner's business is reported as not found, as in getMine.
   */
  private edit(
    target: { businessId: string; ownerId: string },
    apply: (business: Business) => Result<Business, Error>,
  ): Promise<Result<Business, Error>> {
    return this.businessRepository.withBusinessLock(target.businessId, async (business, save) => {
      if (!business || business.ownerId !== target.ownerId) return err(new NotFoundError('Negocio no encontrado'));
      const result = apply(business);
      if (result.ok) await save(business);
      return result;
    });
  }
}
