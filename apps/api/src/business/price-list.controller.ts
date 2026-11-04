import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { PriceListUseCase } from './use-cases/price-list.use-case';
import { CreatePriceListDto, PriceListEntryDto, UpdatePriceListDto, UpdatePriceListEntryDto } from './dto/price-list.dto';
import type { AuthenticatedRequest } from './authenticated-request';

@ApiTags('Listas de Precios')
@Controller('businesses/:businessId/price-lists')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class PriceListController {
  constructor(private readonly listUseCase: PriceListUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear lista de precios' })
  async create(
    @Param('businessId') businessId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePriceListDto,
  ) {
    return unwrap(this.listUseCase.create({ ...dto, businessId, ownerId: req.user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar listas de precios' })
  async list(
    @Param('businessId') businessId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return unwrap(this.listUseCase.list(businessId, activeOnly === 'true'));
  }

  @Get('default')
  @ApiOperation({ summary: 'Obtener lista de precios por defecto' })
  async getDefault(@Param('businessId') businessId: string) {
    return unwrap(this.listUseCase.getDefault(businessId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener lista por ID' })
  async getById(@Param('businessId') businessId: string, @Param('id') id: string) {
    return unwrap(this.listUseCase.getById(id, businessId));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar lista de precios' })
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdatePriceListDto,
  ) {
    return unwrap(this.listUseCase.update({ ...dto, id, businessId, ownerId: req.user.sub }));
  }

  @Post(':id/entries')
  @ApiOperation({ summary: 'Agregar producto a lista de precios' })
  async addEntry(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: PriceListEntryDto,
  ) {
    return unwrap(this.listUseCase.addEntry({ listId: id, businessId, ownerId: req.user.sub, ...dto }));
  }

  @Put(':id/entries/:productId')
  @ApiOperation({ summary: 'Actualizar entrada de lista de precios' })
  async updateEntry(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdatePriceListEntryDto,
  ) {
    return unwrap(this.listUseCase.updateEntry({ listId: id, businessId, ownerId: req.user.sub, productId, ...dto }));
  }

  @Delete(':id/entries/:productId')
  @ApiOperation({ summary: 'Eliminar producto de lista de precios' })
  async removeEntry(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await unwrap(this.listUseCase.removeEntry({ listId: id, businessId, ownerId: req.user.sub, productId }));
    return { ok: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar lista de precios' })
  async delete(@Param('businessId') businessId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await unwrap(this.listUseCase.delete({ id, businessId, ownerId: req.user.sub }));
    return { ok: true };
  }
}
