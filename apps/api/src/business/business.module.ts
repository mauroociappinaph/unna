import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaBusinessRepositoryAdapter } from './adapters/business.repository.adapter';
import { PrismaCategoryRepositoryAdapter, PrismaProductRepositoryAdapter, PrismaModifierGroupRepositoryAdapter, PrismaPriceListRepositoryAdapter, PrismaStockLevelRepositoryAdapter, PrismaStockMovementRepositoryAdapter } from './adapters/product.repository.adapter';
import { OnboardBusinessUseCase } from './use-cases/onboard-business.use-case';
import { BusinessManagementUseCase } from './use-cases/business-management.use-case';
import { CategoryUseCase, ProductUseCase, ModifierGroupUseCase, PriceListUseCase, StockUseCase } from './use-cases/product-catalog.use-case';
import { BusinessController } from './business.controller';
import { CategoryController, ProductController, ModifierGroupController, PriceListController, StockController } from './catalog.controller';
import { PrismaOrderRepositoryAdapter, PrismaPaymentRepositoryAdapter, PrismaSalesUnitOfWorkAdapter } from './adapters/sales.repository.adapter';
import { InvoicingUseCase } from './use-cases/invoicing.use-case';
import { PrismaFiscalReceiptRepositoryAdapter } from './adapters/receipt.repository.adapter';
import { PrismaReceiptIssueUnitOfWorkAdapter } from './adapters/receipt-sequence.adapter';
import { ArcaSimulatedAdapter } from './adapters/arca-simulated.adapter';

/**
 * The simulator returns made-up CAEs: receipts it "authorizes" have no fiscal validity. It must never
 * run in production; until the real ARCA adapter exists (T30f) the API refuses to start there.
 */
export function fiscalAuthorizerFactory(env: NodeJS.ProcessEnv = process.env): ArcaSimulatedAdapter {
  if (env.NODE_ENV === 'production') {
    throw new Error('ARCA real no configurado: el simulador de ARCA no puede usarse en producción');
  }
  return new ArcaSimulatedAdapter();
}
import { SalesUseCase } from './use-cases/sales.use-case';
import { SalesController } from './sales.controller';
import { CashController } from './cash.controller';
import { CashUseCase } from './use-cases/cash.use-case';
import { PrismaCashSessionRepositoryAdapter, PrismaCashUnitOfWorkAdapter } from './adapters/cash.repository.adapter';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessController, CategoryController, ProductController, ModifierGroupController, PriceListController, StockController, SalesController, CashController],
  providers: [
    OnboardBusinessUseCase,
    BusinessManagementUseCase,
    CategoryUseCase,
    ProductUseCase,
    ModifierGroupUseCase,
    PriceListUseCase,
    StockUseCase,
    SalesUseCase,
    CashUseCase,
    { provide: 'CashSessionRepositoryPort', useClass: PrismaCashSessionRepositoryAdapter },
    { provide: 'CashUnitOfWorkPort', useClass: PrismaCashUnitOfWorkAdapter },
    BusinessOwnerGuard,
    { provide: 'OrderRepositoryPort', useClass: PrismaOrderRepositoryAdapter },
    { provide: 'PaymentRepositoryPort', useClass: PrismaPaymentRepositoryAdapter },
    { provide: 'ReceiptRepositoryPort', useClass: PrismaFiscalReceiptRepositoryAdapter },
    InvoicingUseCase,
    { provide: 'ReceiptIssueUnitOfWorkPort', useClass: PrismaReceiptIssueUnitOfWorkAdapter },
    { provide: 'FiscalAuthorizerPort', useFactory: () => fiscalAuthorizerFactory() },
    { provide: 'SalesUnitOfWorkPort', useClass: PrismaSalesUnitOfWorkAdapter },
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