import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaBusinessRepositoryAdapter } from './adapters/business.repository.adapter';
import { PrismaCategoryRepositoryAdapter } from './adapters/category.repository.adapter';
import { PrismaProductRepositoryAdapter } from './adapters/product.repository.adapter';
import { PrismaModifierGroupRepositoryAdapter } from './adapters/modifier-group.repository.adapter';
import { PrismaPriceListRepositoryAdapter } from './adapters/price-list.repository.adapter';
import { PrismaStockLevelRepositoryAdapter } from './adapters/stock-level.repository.adapter';
import { PrismaStockMovementRepositoryAdapter } from './adapters/stock-movement.repository.adapter';
import { OnboardBusinessUseCase } from './use-cases/onboard-business.use-case';
import { BusinessManagementUseCase } from './use-cases/business-management.use-case';
import { CategoryUseCase } from './use-cases/category.use-case';
import { ProductUseCase } from './use-cases/product.use-case';
import { ModifierGroupUseCase } from './use-cases/modifier-group.use-case';
import { PriceListUseCase } from './use-cases/price-list.use-case';
import { StockUseCase } from './use-cases/stock.use-case';
import { BusinessController } from './business.controller';
import { CategoryController } from './category.controller';
import { ProductController } from './product.controller';
import { ModifierGroupController } from './modifier-group.controller';
import { PriceListController } from './price-list.controller';
import { StockController } from './stock.controller';
import { PrismaOrderRepositoryAdapter, PrismaPaymentRepositoryAdapter, PrismaSalesUnitOfWorkAdapter } from './adapters/sales.repository.adapter';
import { InvoicingUseCase } from './use-cases/invoicing.use-case';
import { PrismaFiscalReceiptRepositoryAdapter } from './adapters/receipt.repository.adapter';
import { PrismaReceiptIssueUnitOfWorkAdapter } from './adapters/receipt-sequence.adapter';
import { ArcaSimulatedAdapter } from './adapters/arca-simulated.adapter';
import { isArcaConfigured } from './adapters/arca/arca.config';
import { createArcaFiscalAuthorizer } from './adapters/arca/arca-fiscal-authorizer.adapter';
import type { FiscalAuthorizerPort } from '@unna/domain';

/**
 * Real ARCA when ARCA_ENV, ARCA_CERT_PATH and ARCA_KEY_PATH are set. Otherwise the simulator, which
 * returns made-up CAEs: receipts it "authorizes" have no fiscal validity, so it never runs in production.
 */
export function fiscalAuthorizerFactory(env: NodeJS.ProcessEnv = process.env): FiscalAuthorizerPort {
  if (isArcaConfigured(env)) return createArcaFiscalAuthorizer(env);
  if (env.NODE_ENV === 'production') {
    throw new Error('ARCA real no configurado: el simulador de ARCA no puede usarse en producción');
  }
  return new ArcaSimulatedAdapter();
}
import { SalesUseCase } from './use-cases/sales.use-case';
import { SalesController } from './sales.controller';
import { CashController } from './cash.controller';
import { OrderBoardController } from './order-board.controller';
import { PublicOrderBoardController } from './public-order-board.controller';
import { OrderBoardUseCase } from './use-cases/order-board.use-case';
import { PrismaOrderBoardRepositoryAdapter } from './adapters/order-board.repository.adapter';
import { ThrottlerModule } from '@nestjs/throttler';
import { publicBoardThrottlerOptions } from './public-board-throttle';
import { CashUseCase } from './use-cases/cash.use-case';
import { PrismaCashSessionRepositoryAdapter, PrismaCashUnitOfWorkAdapter } from './adapters/cash.repository.adapter';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';

@Module({
  imports: [PrismaModule, ThrottlerModule.forRoot(publicBoardThrottlerOptions())],
  controllers: [BusinessController, CategoryController, ProductController, ModifierGroupController, PriceListController, StockController, SalesController, CashController, OrderBoardController, PublicOrderBoardController],
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
    OrderBoardUseCase,
    { provide: 'OrderBoardRepositoryPort', useClass: PrismaOrderBoardRepositoryAdapter },
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