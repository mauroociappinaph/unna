import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaBusinessRepositoryAdapter } from './adapters/business.repository.adapter';
import { PrismaCategoryRepositoryAdapter, PrismaProductRepositoryAdapter, PrismaModifierGroupRepositoryAdapter, PrismaPriceListRepositoryAdapter, PrismaStockLevelRepositoryAdapter, PrismaStockMovementRepositoryAdapter } from './adapters/product.repository.adapter';
import { OnboardBusinessUseCase } from './use-cases/onboard-business.use-case';
import { BusinessManagementUseCase } from './use-cases/business-management.use-case';
import { CategoryUseCase, ProductUseCase, ModifierGroupUseCase, PriceListUseCase, StockUseCase } from './use-cases/product-catalog.use-case';
import { BusinessController } from './business.controller';
import { CategoryController, ProductController, ModifierGroupController, PriceListController, StockController } from './catalog.controller';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessController, CategoryController, ProductController, ModifierGroupController, PriceListController, StockController],
  providers: [
    OnboardBusinessUseCase,
    BusinessManagementUseCase,
    CategoryUseCase,
    ProductUseCase,
    ModifierGroupUseCase,
    PriceListUseCase,
    StockUseCase,
    BusinessOwnerGuard,
    {
      provide: 'BusinessRepositoryPort',
      useClass: PrismaBusinessRepositoryAdapter,
    },
    {
      provide: 'CategoryRepositoryPort',
      useClass: PrismaCategoryRepositoryAdapter,
    },
    {
      provide: 'ProductRepositoryPort',
      useClass: PrismaProductRepositoryAdapter,
    },
    {
      provide: 'ModifierGroupRepositoryPort',
      useClass: PrismaModifierGroupRepositoryAdapter,
    },
    {
      provide: 'PriceListRepositoryPort',
      useClass: PrismaPriceListRepositoryAdapter,
    },
    {
      provide: 'StockLevelRepositoryPort',
      useClass: PrismaStockLevelRepositoryAdapter,
    },
    {
      provide: 'StockMovementRepositoryPort',
      useClass: PrismaStockMovementRepositoryAdapter,
    },
  ],
  exports: [
    OnboardBusinessUseCase, 
    BusinessManagementUseCase, 
    CategoryUseCase, 
    ProductUseCase, 
    ModifierGroupUseCase, 
    PriceListUseCase, 
    StockUseCase, 
    'BusinessRepositoryPort',
    'CategoryRepositoryPort',
    'ProductRepositoryPort',
    'ModifierGroupRepositoryPort',
    'PriceListRepositoryPort',
    'StockLevelRepositoryPort',
    'StockMovementRepositoryPort',
  ],
})
export class BusinessModule {}
