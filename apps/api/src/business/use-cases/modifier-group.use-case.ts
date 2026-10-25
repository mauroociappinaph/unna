import { Inject, Injectable } from '@nestjs/common';
import { ModifierGroupRepositoryPort, ModifierGroup, ModifierOption } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

interface ModifierOptionInput {
  name: string;
  priceDelta?: number;
  isDefault?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

interface ModifierGroupInput {
  name: string;
  description?: string;
  minSelection?: number;
  maxSelection?: number;
  isRequired?: boolean;
  displayOrder?: number;
  isActive?: boolean;
  options?: Array<ModifierOptionInput>;
}

@Injectable()
export class ModifierGroupUseCase {
  constructor(
    @Inject('ModifierGroupRepositoryPort')
    private readonly groupRepository: ModifierGroupRepositoryPort,
  ) {}

  async create(command: { businessId: string; ownerId: string } & ModifierGroupInput): Promise<UseCaseResult<ModifierGroup>> {
    const group = ModifierGroup.create({
      businessId: command.businessId,
      name: command.name,
      description: command.description,
      minSelection: command.minSelection ?? 0,
      maxSelection: command.maxSelection ?? 0,
      isRequired: command.isRequired ?? false,
      displayOrder: command.displayOrder ?? 0,
      isActive: command.isActive ?? true,
      options: command.options?.map((o) => ModifierOption.create({
        name: o.name,
        priceDelta: o.priceDelta ?? 0,
        isDefault: o.isDefault ?? false,
        displayOrder: o.displayOrder ?? 0,
        isActive: o.isActive ?? true,
      })) ?? [],
    });
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async update(command: { id: string; businessId: string; ownerId: string } & Partial<ModifierGroupInput>): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo de modificadores no encontrado') };

    if (command.name !== undefined) group = group.updateName(command.name);
    if (command.description !== undefined) group = group.updateDescription(command.description);
    if (command.minSelection !== undefined) group = group.setMinSelection(command.minSelection);
    if (command.maxSelection !== undefined) group = group.setMaxSelection(command.maxSelection);
    if (command.isRequired !== undefined) group = group.setRequired(command.isRequired);
    if (command.isActive !== undefined) {
      group = command.isActive ? group.activate() : group.deactivate();
    }

    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async addOption(command: { groupId: string; businessId: string; ownerId: string; option: ModifierOptionInput }): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.groupId, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    const option = ModifierOption.create({
      name: command.option.name,
      priceDelta: command.option.priceDelta ?? 0,
      isDefault: command.option.isDefault ?? false,
      displayOrder: command.option.displayOrder ?? 0,
      isActive: command.option.isActive ?? true,
    });
    group = group.addOption(option);
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async updateOption(command: { groupId: string; businessId: string; ownerId: string; optionId: string; updates: Partial<ModifierOptionInput> }): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.groupId, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    group = group.updateOption(command.optionId, (o: ModifierOption) => {
      if (command.updates.name !== undefined) o = o.updateName(command.updates.name);
      if (command.updates.priceDelta !== undefined) o = o.updatePriceDelta(command.updates.priceDelta);
      if (command.updates.isDefault !== undefined) o = command.updates.isDefault ? o.setAsDefault() : o.unsetAsDefault();
      if (command.updates.isActive !== undefined) o = command.updates.isActive ? o.activate() : o.deactivate();
      return o;
    });
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async deleteOption(command: { groupId: string; businessId: string; ownerId: string; optionId: string }): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.groupId, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    group = group.removeOption(command.optionId);
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async delete(command: { id: string; businessId: string; ownerId: string }): Promise<UseCaseResult<void>> {
    const group = await this.groupRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    await this.groupRepository.delete(command.id);
    return { ok: true };
  }

  async getById(id: string, businessId: string): Promise<UseCaseResult<ModifierGroup>> {
    const group = await this.groupRepository.findByIdAndBusinessId(id, businessId);
    return group ? { ok: true, value: group } : { ok: false, error: new Error('Grupo no encontrado') };
  }

  async list(businessId: string, activeOnly = false): Promise<UseCaseResult<ModifierGroup[]>> {
    const groups = activeOnly 
      ? await this.groupRepository.findActiveByBusinessId(businessId)
      : await this.groupRepository.findByBusinessId(businessId);
    return { ok: true, value: groups };
  }
}
