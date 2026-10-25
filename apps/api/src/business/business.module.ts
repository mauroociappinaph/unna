import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaBusinessRepositoryAdapter } from './adapters/business.repository.adapter';
import { OnboardBusinessUseCase } from './use-cases/onboard-business.use-case';
import { BusinessManagementUseCase } from './use-cases/business-management.use-case';
import { BusinessController } from './business.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BusinessController],
  providers: [
    OnboardBusinessUseCase,
    BusinessManagementUseCase,
    {
      provide: 'BusinessRepositoryPort',
      useClass: PrismaBusinessRepositoryAdapter,
    },
  ],
  exports: [OnboardBusinessUseCase, BusinessManagementUseCase, 'BusinessRepositoryPort'],
})
export class BusinessModule {}