import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, CategoryRepositoryPort, Category } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

interface CategoryInput {
  name: string;
  description?: string;
  type: 'plato' | 'bebida' | 'postre' | 'extra' | 'combo';
  displayOrder?: number;
  isActive?: boolean;
  parentId?: string;
  imageUrl?: string;
}

@Injectable()
export class CategoryUseCase {
  constructor(
    @Inject('CategoryRepositoryPort')
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async create(command: { businessId: string; ownerId: string } & CategoryInput): Promise<UseCaseResult<Category>> {
    const parentError = await this.checkParent(command.parentId, command.businessId);
    if (parentError) return parentError;
    const category = Category.create({
      ...command,
      businessId: command.businessId,
      displayOrder: command.displayOrder ?? 0,
      isActive: command.isActive ?? true,
    });
    await this.categoryRepository.save(category);
    return { ok: true, value: category };
  }

  async update(command: { id: string; businessId: string; ownerId: string } & Partial<CategoryInput>): Promise<UseCaseResult<Category>> {
    let category = await this.categoryRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!category) return { ok: false, error: new NotFoundError('Categoría no encontrada') };
    if (command.parentId === command.id) return { ok: false, error: new Error('Una categoría no puede ser su propia categoría padre') };
    const parentError = await this.checkParent(command.parentId, command.businessId);
    if (parentError) return parentError;

    if (command.name !== undefined) category = category.updateName(command.name);
    if (command.description !== undefined) category = category.updateDescription(command.description);
    if (command.type !== undefined) category = category.updateType(command.type);
    if (command.displayOrder !== undefined) category = category.updateDisplayOrder(command.displayOrder);
    if (command.parentId !== undefined) category = category.setParent(command.parentId);
    if (command.imageUrl !== undefined) category = category.updateImage(command.imageUrl);
    if (command.isActive !== undefined) {
      category = command.isActive ? category.activate() : category.deactivate();
    }

    await this.categoryRepository.save(category);
    return { ok: true, value: category };
  }

  async delete(command: { id: string; businessId: string; ownerId: string }): Promise<UseCaseResult<void>> {
    const category = await this.categoryRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!category) return { ok: false, error: new NotFoundError('Categoría no encontrada') };
    await this.categoryRepository.delete(command.id);
    return { ok: true };
  }

  async getById(id: string, businessId: string): Promise<UseCaseResult<Category>> {
    const category = await this.categoryRepository.findByIdAndBusinessId(id, businessId);
    return category ? { ok: true, value: category } : { ok: false, error: new NotFoundError('Categoría no encontrada') };
  }

  private async checkParent(parentId: string | undefined, businessId: string): Promise<UseCaseResult<never> | null> {
    if (!parentId) return null;
    const parent = await this.categoryRepository.findByIdAndBusinessId(parentId, businessId);
    return parent ? null : { ok: false, error: new NotFoundError('Categoría padre no encontrada') };
  }

  async list(businessId: string, activeOnly = false): Promise<UseCaseResult<Category[]>> {
    const categories = activeOnly 
      ? await this.categoryRepository.findActiveByBusinessId(businessId)
      : await this.categoryRepository.findByBusinessId(businessId);
    return { ok: true, value: categories };
  }
}
