import { Inject, Injectable } from '@nestjs/common';
import { StockLevelRepositoryPort, StockMovementRepositoryPort, ProductRepositoryPort, StockLevel, StockMovement, StockMovementType } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

interface StockMovementInput {
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'waste' | 'transfer' | 'sale' | 'return';
  quantity: number;
  reason: string;
  referenceId?: string;
  referenceType?: string;
  unitCost?: number;
  totalCost?: number;
  performedBy: string;
}

/** Stock entries and exits: the movement fields the caller sends; the user performing it is the owner. */
type StockMovementCommand = Omit<StockMovementInput, 'type' | 'performedBy'>;

export interface StockChange {
  level: StockLevel;
  movement: StockMovement;
}

@Injectable()
export class StockUseCase {
  constructor(
    @Inject('StockLevelRepositoryPort')
    private readonly stockRepository: StockLevelRepositoryPort,
    @Inject('StockMovementRepositoryPort')
    private readonly movementRepository: StockMovementRepositoryPort,
    @Inject('ProductRepositoryPort')
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async addStock(command: { businessId: string; ownerId: string } & StockMovementCommand): Promise<UseCaseResult<StockChange>> {
    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) {
      return { ok: false, error: new Error('Nivel de stock no inicializado para este producto') };
    }

    const movement = StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type: 'in',
      quantity: command.quantity,
      reason: command.reason,
      referenceId: command.referenceId,
      referenceType: command.referenceType,
      unitCost: command.unitCost,
      totalCost: command.totalCost,
      performedBy: command.ownerId,
    });

    const updatedLevel = level.addStock(command.quantity, movement);
    await this.stockRepository.save(updatedLevel);
    await this.movementRepository.save(movement);

    return { ok: true, value: { level: updatedLevel, movement } };
  }

  async removeStock(command: { businessId: string; ownerId: string; type?: StockMovementType } & StockMovementCommand): Promise<UseCaseResult<StockChange>> {
    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) return { ok: false, error: new Error('Nivel de stock no encontrado') };

    const movement = StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type: command.type ?? 'out',
      quantity: command.quantity,
      reason: command.reason,
      referenceId: command.referenceId,
      referenceType: command.referenceType,
      unitCost: command.unitCost,
      totalCost: command.totalCost,
      performedBy: command.ownerId,
    });

    const updatedLevel = level.removeStock(command.quantity, movement);
    await this.stockRepository.save(updatedLevel);
    await this.movementRepository.save(movement);

    return { ok: true, value: { level: updatedLevel, movement } };
  }

  private async productMissing(productId: string, businessId: string): Promise<UseCaseResult<never> | null> {
    const product = await this.productRepository.findByIdAndBusinessId(productId, businessId);
    return product ? null : { ok: false, error: new Error('Producto no encontrado') };
  }

  async recordCount(command: { productId: string; businessId: string; ownerId: string; countedQuantity: number }): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;
    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) return { ok: false, error: new Error('Nivel de stock no encontrado') };

    const updatedLevel = level.recordCount(command.countedQuantity);
    await this.stockRepository.save(updatedLevel);
    return { ok: true, value: updatedLevel };
  }

  async adjustThresholds(command: { productId: string; businessId: string; ownerId: string; minThreshold?: number; maxThreshold?: number; reorderPoint?: number; reorderQuantity?: number }): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;
    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) return { ok: false, error: new Error('Nivel de stock no encontrado') };

    const updatedLevel = level.adjustThresholds(command.minThreshold, command.maxThreshold, command.reorderPoint, command.reorderQuantity);
    await this.stockRepository.save(updatedLevel);
    return { ok: true, value: updatedLevel };
  }

  async initializeStock(command: { productId: string; businessId: string; ownerId: string; initialQuantity: number; minThreshold?: number; reorderPoint?: number; reorderQuantity?: number }): Promise<UseCaseResult<StockLevel>> {
    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const existing = await this.stockRepository.findByProductId(command.productId);
    if (existing) return { ok: false, error: new Error('El stock ya está inicializado para este producto') };

    const level = StockLevel.create({
      productId: command.productId,
      businessId: command.businessId,
      currentQuantity: command.initialQuantity,
      reservedQuantity: 0,
      minThreshold: command.minThreshold ?? 10,
      reorderPoint: command.reorderPoint ?? 5,
      reorderQuantity: command.reorderQuantity ?? 20,
    });

    await this.stockRepository.save(level);

    const movement = StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type: 'in',
      quantity: command.initialQuantity,
      reason: 'Stock inicial',
      performedBy: command.ownerId,
    });
    await this.movementRepository.save(movement);

    return { ok: true, value: level };
  }

  async getLevel(productId: string, businessId: string): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(productId, businessId);
    if (missing) return missing;
    const level = await this.stockRepository.findByProductId(productId);
    return level ? { ok: true, value: level } : { ok: false, error: new Error('Nivel de stock no encontrado') };
  }

  async getLowStock(businessId: string): Promise<UseCaseResult<StockLevel[]>> {
    const levels = await this.stockRepository.findLowStock(businessId);
    return { ok: true, value: levels };
  }

  async listByBusiness(businessId: string): Promise<UseCaseResult<StockLevel[]>> {
    const levels = await this.stockRepository.findByBusinessId(businessId);
    return { ok: true, value: levels };
  }

  async listMovements(businessId: string, filters?: { productId?: string; from?: Date; to?: Date }): Promise<UseCaseResult<StockMovement[]>> {
    let movements: StockMovement[];
    if (filters?.from && filters?.to) {
      movements = await this.movementRepository.findByBusinessIdAndDateRange(businessId, filters.from, filters.to);
    } else if (filters?.productId) {
      const missing = await this.productMissing(filters.productId, businessId);
      if (missing) return missing;
      movements = await this.movementRepository.findByProductId(filters.productId);
    } else {
      movements = await this.movementRepository.findByBusinessId(businessId);
    }
    return { ok: true, value: movements };
  }
}
