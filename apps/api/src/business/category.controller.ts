import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { CategoryUseCase } from './use-cases/category.use-case';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import type { AuthenticatedRequest } from './authenticated-request';

@ApiTags('Categorías')
@Controller('businesses/:businessId/categories')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryUseCase: CategoryUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva categoría' })
  async create(
    @Param('businessId') businessId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ) {
    return unwrap(this.categoryUseCase.create({ ...dto, businessId, ownerId: req.user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías' })
  async list(
    @Param('businessId') businessId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return unwrap(this.categoryUseCase.list(businessId, activeOnly === 'true'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  async getById(@Param('businessId') businessId: string, @Param('id') id: string) {
    return unwrap(this.categoryUseCase.getById(id, businessId));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar categoría' })
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateCategoryDto,
  ) {
    return unwrap(this.categoryUseCase.update({ ...dto, id, businessId, ownerId: req.user.sub }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  async delete(@Param('businessId') businessId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await unwrap(this.categoryUseCase.delete({ id, businessId, ownerId: req.user.sub }));
    return { ok: true };
  }
}
