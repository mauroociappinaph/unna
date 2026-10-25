import { Inject, Injectable } from '@nestjs/common';
import { PriceListRepositoryPort, ProductRepositoryPort, PriceList, PriceListEntry, Money } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

interface PriceListInput {
  name: string;
  description?: string;
  type: 'standard' | 'delivery' | 'takeaway' | 'happy-hour' | 'event' | 'custom';
  isDefault?: boolean;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
  validDays?: number[];
  validFromTime?: string;
  validToTime?: string;
  entries?: Array<{
    productId: string;
    price: number;
    costPrice?: number;
    isActive?: boolean;
  }>;
}

@Injectable()
export class PriceListUseCase {
  constructor(
    @Inject('PriceListRepositoryPort')
    private readonly listRepository: PriceListRepositoryPort,
    @Inject('ProductRepositoryPort')
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async create(command: { businessId: string; ownerId: string } & PriceListInput): Promise<UseCaseResult<PriceList>> {
    // Validate products exist
    if (command.entries) {
      for (const entry of command.entries) {
        const product = await this.productRepository.findByIdAndBusinessId(entry.productId, command.businessId);
        if (!product) return { ok: false, error: new Error(`Producto ${entry.productId} no encontrado`) };
      }
    }

    const list = PriceList.create({
      businessId: command.businessId,
      name: command.name,
      description: command.description,
      type: command.type,
      isDefault: command.isDefault ?? false,
      isActive: command.isActive ?? true,
      validFrom: command.validFrom ? new Date(command.validFrom) : undefined,
      validTo: command.validTo ? new Date(command.validTo) : undefined,
      validDays: command.validDays,
      validFromTime: command.validFromTime,
      validToTime: command.validToTime,
      entries: command.entries?.map((e) => PriceListEntry.create({
        productId: e.productId,
        price: Money.fromCents(e.price, 'ARS'),
        costPrice: e.costPrice ? Money.fromCents(e.costPrice, 'ARS') : undefined,
        isActive: e.isActive ?? true,
      })) ?? [],
    });

    // If this is set as default, unset others
    if (command.isDefault) {
      const lists = await this.listRepository.findActiveByBusinessId(command.businessId);
      for (const other of lists) {
        if (other.isDefault) {
          await this.listRepository.save(other.unsetAsDefault());
        }
      }
    }

    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async update(command: { id: string; businessId: string; ownerId: string } & Partial<PriceListInput>): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista de precios no encontrada') };

    if (command.name !== undefined) list = list.updateName(command.name);
    if (command.description !== undefined) list = list.updateDescription(command.description);
    if (command.isDefault !== undefined) list = command.isDefault ? list.setAsDefault() : list.unsetAsDefault();
    if (command.isActive !== undefined) list = command.isActive ? list.activate() : list.deactivate();
    if (command.validFrom !== undefined || command.validTo !== undefined) list = list.setValidityPeriod(command.validFrom ? new Date(command.validFrom) : undefined, command.validTo ? new Date(command.validTo) : undefined);
    if (command.validDays !== undefined) list = list.setValidDays(command.validDays);
    if (command.validFromTime !== undefined || command.validToTime !== undefined) list = list.setValidHours(command.validFromTime, command.validToTime);

    // If setting as default, unset others
    if (command.isDefault) {
      const lists = await this.listRepository.findActiveByBusinessId(command.businessId);
      for (const other of lists) {
        if (other.id !== command.id && other.isDefault) {
          await this.listRepository.save(other.unsetAsDefault());
        }
      }
    }

    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async addEntry(command: { listId: string; businessId: string; ownerId: string; productId: string; price: number; costPrice?: number; isActive?: boolean }): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.listId, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };

    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const entry = PriceListEntry.create({
      productId: command.productId,
      price: Money.fromCents(command.price, 'ARS'),
      costPrice: command.costPrice ? Money.fromCents(command.costPrice, 'ARS') : undefined,
      isActive: command.isActive ?? true,
    });

    list = list.addEntry(entry);
    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async updateEntry(command: { listId: string; businessId: string; ownerId: string; productId: string; price?: number; costPrice?: number; isActive?: boolean }): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.listId, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };

    if (command.price !== undefined) list = list.setEntryPrice(command.productId, Money.fromCents(command.price, 'ARS'));
    if (command.costPrice !== undefined) list = list.updateEntry(command.productId, (e: PriceListEntry) => e.updateCostPrice(command.costPrice ? Money.fromCents(command.costPrice, 'ARS') : undefined));
    if (command.isActive !== undefined) list = list.updateEntry(command.productId, (e: PriceListEntry) => command.isActive ? e.activate() : e.deactivate());

    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async removeEntry(command: { listId: string; businessId: string; ownerId: string; productId: string }): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.listId, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };
    list = list.removeEntry(command.productId);
    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async delete(command: { id: string; businessId: string; ownerId: string }): Promise<UseCaseResult<void>> {
    const list = await this.listRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };
    await this.listRepository.delete(command.id);
    return { ok: true };
  }

  async getById(id: string, businessId: string): Promise<UseCaseResult<PriceList>> {
    const list = await this.listRepository.findByIdAndBusinessId(id, businessId);
    return list ? { ok: true, value: list } : { ok: false, error: new Error('Lista no encontrada') };
  }

  async list(businessId: string, activeOnly = false): Promise<UseCaseResult<PriceList[]>> {
    const lists = activeOnly 
      ? await this.listRepository.findActiveByBusinessId(businessId)
      : await this.listRepository.findByBusinessId(businessId);
    return { ok: true, value: lists };
  }

  async getDefault(businessId: string): Promise<UseCaseResult<PriceList>> {
    const list = await this.listRepository.findDefaultByBusinessId(businessId);
    return list ? { ok: true, value: list } : { ok: false, error: new Error('No hay lista por defecto') };
  }
}
