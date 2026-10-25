import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { StockUseCase } from './use-cases/stock.use-case';
import { AddStockDto, AdjustThresholdsDto, InitializeStockDto, RecordCountDto, RemoveStockDto } from './dto/stock.dto';
import type { AuthenticatedRequest } from './authenticated-request';

@ApiTags('Stock / Inventario')
@Controller('businesses/:businessId/stock')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class StockController {
  constructor(private readonly stockUseCase: StockUseCase) {}

  @Post('initialize/:productId')
  @ApiOperation({ summary: 'Inicializar stock de un producto' })
  async initialize(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: InitializeStockDto,
  ) {
    return unwrap(this.stockUseCase.initializeStock({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Get('levels')
  @ApiOperation({ summary: 'Listar niveles de stock' })
  async listLevels(@Param('businessId') businessId: string) {
    return unwrap(this.stockUseCase.listByBusiness(businessId));
  }

  @Get('low')
  @ApiOperation({ summary: 'Obtener productos con stock bajo' })
  async getLowStock(@Param('businessId') businessId: string) {
    return unwrap(this.stockUseCase.getLowStock(businessId));
  }

  @Get('movements')
  @ApiOperation({ summary: 'Listar movimientos de stock' })
  async listMovements(
    @Param('businessId') businessId: string,
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return unwrap(this.stockUseCase.listMovements(businessId, {
      productId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    }));
  }

  @Get('level/:productId')
  @ApiOperation({ summary: 'Obtener nivel de stock de un producto' })
  async getLevel(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return unwrap(this.stockUseCase.getLevel(productId, businessId));
  }

  @Post('in/:productId')
  @ApiOperation({ summary: 'Registrar entrada de stock' })
  async addStock(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddStockDto,
  ) {
    return unwrap(this.stockUseCase.addStock({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Post('out/:productId')
  @ApiOperation({ summary: 'Registrar salida de stock' })
  async removeStock(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: RemoveStockDto,
  ) {
    return unwrap(this.stockUseCase.removeStock({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Post('count/:productId')
  @ApiOperation({ summary: 'Registrar conteo físico' })
  async recordCount(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: RecordCountDto,
  ) {
    return unwrap(this.stockUseCase.recordCount({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Put('thresholds/:productId')
  @ApiOperation({ summary: 'Ajustar umbrales de stock' })
  async adjustThresholds(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AdjustThresholdsDto,
  ) {
    return unwrap(this.stockUseCase.adjustThresholds({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }
}
