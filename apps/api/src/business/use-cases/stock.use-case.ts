import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  Page,
  PageRequest,
  StockLevelRepositoryPort,
  StockMovementListFilters,
  StockMovementRepositoryPort,
  ProductRepositoryPort,
  StockLevel,
  StockMovement,
  StockMovementType,
  StockUnitOfWorkPort,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { pageOrInvalidCursor } from './page-result';

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
    @Inject('StockUnitOfWorkPort')
    private readonly stockUnitOfWork: StockUnitOfWorkPort,
  ) {}

  async addStock(command: { businessId: string; ownerId: string } & StockMovementCommand): Promise<UseCaseResult<StockChange>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;

    const movement = this.movementOf(command, 'in');
    return this.stockUnitOfWork.withStockLock(command.productId, async (level, writes) => {
      if (!level) return { ok: false, error: new Error('Nivel de stock no inicializado para este producto') };
      const updatedLevel = level.addStock(command.quantity, movement);
      await writes.saveLevel(updatedLevel);
      await writes.saveMovement(movement);
      return { ok: true, value: { level: updatedLevel, movement } };
    });
  }

  /** The insufficient stock check runs on the level read under the lock and throws, writing nothing. */
  async removeStock(command: { businessId: string; ownerId: string; type?: StockMovementType } & StockMovementCommand): Promise<UseCaseResult<StockChange>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;

    const movement = this.movementOf(command, command.type ?? 'out');
    return this.stockUnitOfWork.withStockLock(command.productId, async (level, writes) => {
      if (!level) return { ok: false, error: new NotFoundError('Nivel de stock no encontrado') };
      const updatedLevel = level.removeStock(command.quantity, movement);
      await writes.saveLevel(updatedLevel);
      await writes.saveMovement(movement);
      return { ok: true, value: { level: updatedLevel, movement } };
    });
  }

  private movementOf(command: { businessId: string; ownerId: string } & StockMovementCommand, type: StockMovementType): StockMovement {
    return StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type,
      quantity: command.quantity,
      reason: command.reason,
      referenceId: command.referenceId,
      referenceType: command.referenceType,
      unitCost: command.unitCost,
      totalCost: command.totalCost,
      performedBy: command.ownerId,
    });
  }

  private async productMissing(productId: string, businessId: string): Promise<UseCaseResult<never> | null> {
    const product = await this.productRepository.findByIdAndBusinessId(productId, businessId);
    return product ? null : { ok: false, error: new NotFoundError('Producto no encontrado') };
  }

  /** The count and its adjustment movement (none when the count matches) are saved together. */
  async recordCount(command: { productId: string; businessId: string; ownerId: string; countedQuantity: number }): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;

    return this.stockUnitOfWork.withStockLock(command.productId, async (level, writes) => {
      if (!level) return { ok: false, error: new NotFoundError('Nivel de stock no encontrado') };
      const counted = level.recordCount(command.countedQuantity, command.ownerId);
      await writes.saveLevel(counted.level);
      if (counted.movement) await writes.saveMovement(counted.movement);
      return { ok: true, value: counted.level };
    });
  }

  async adjustThresholds(command: { productId: string; businessId: string; ownerId: string; minThreshold?: number; maxThreshold?: number; reorderPoint?: number; reorderQuantity?: number }): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;

    return this.stockUnitOfWork.withStockLock(command.productId, async (level, writes) => {
      if (!level) return { ok: false, error: new NotFoundError('Nivel de stock no encontrado') };
      const updatedLevel = level.adjustThresholds(command.minThreshold, command.maxThreshold, command.reorderPoint, command.reorderQuantity);
      await writes.saveLevel(updatedLevel);
      return { ok: true, value: updatedLevel };
    });
  }

  async initializeStock(command: { productId: string; businessId: string; ownerId: string; initialQuantity: number; minThreshold?: number; reorderPoint?: number; reorderQuantity?: number }): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;

    const alreadyInitialized: UseCaseResult<StockLevel> = { ok: false, error: new Error('El stock ya está inicializado para este producto') };
    if (await this.stockRepository.findByProductId(command.productId)) return alreadyInitialized;

    const level = StockLevel.create({
      productId: command.productId,
      businessId: command.businessId,
      currentQuantity: command.initialQuantity,
      reservedQuantity: 0,
      minThreshold: command.minThreshold ?? 10,
      reorderPoint: command.reorderPoint ?? 5,
      reorderQuantity: command.reorderQuantity ?? 20,
    });
    // Starting at zero moves nothing.
    const movement = command.initialQuantity === 0 ? null : StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type: 'in',
      quantity: command.initialQuantity,
      reason: 'Stock inicial',
      performedBy: command.ownerId,
    });

    // A concurrent initialization that won the insert makes this one write nothing.
    return (await this.stockUnitOfWork.initialize(level, movement)) ? { ok: true, value: level } : alreadyInitialized;
  }

  async getLevel(productId: string, businessId: string): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(productId, businessId);
    if (missing) return missing;
    const level = await this.stockRepository.findByProductId(productId);
    return level ? { ok: true, value: level } : { ok: false, error: new NotFoundError('Nivel de stock no encontrado') };
  }

  async getLowStock(businessId: string): Promise<UseCaseResult<StockLevel[]>> {
    const levels = await this.stockRepository.findLowStock(businessId);
    return { ok: true, value: levels };
  }

  async listByBusiness(businessId: string): Promise<UseCaseResult<StockLevel[]>> {
    const levels = await this.stockRepository.findByBusinessId(businessId);
    return { ok: true, value: levels };
  }

  /** Newest first; the product, from and to filters apply together. */
  async listMovements(businessId: string, filters: StockMovementListFilters, page: PageRequest): Promise<UseCaseResult<Page<StockMovement>>> {
    if (filters.productId) {
      const missing = await this.productMissing(filters.productId, businessId);
      if (missing) return missing;
    }
    return pageOrInvalidCursor(await this.movementRepository.findPageByBusinessId(businessId, filters, page));
  }
}
