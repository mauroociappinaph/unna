import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { ModifierGroupUseCase } from './use-cases/modifier-group.use-case';
import { CreateModifierGroupDto, ModifierOptionDto, UpdateModifierGroupDto, UpdateModifierOptionDto } from './dto/modifier-group.dto';
import type { AuthenticatedRequest } from './authenticated-request';

@ApiTags('Grupos de Modificadores')
@Controller('businesses/:businessId/modifier-groups')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class ModifierGroupController {
  constructor(private readonly groupUseCase: ModifierGroupUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear grupo de modificadores' })
  async create(
    @Param('businessId') businessId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateModifierGroupDto,
  ) {
    return unwrap(this.groupUseCase.create({ ...dto, businessId, ownerId: req.user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar grupos de modificadores' })
  async list(
    @Param('businessId') businessId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return unwrap(this.groupUseCase.list(businessId, activeOnly === 'true'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener grupo por ID' })
  async getById(@Param('businessId') businessId: string, @Param('id') id: string) {
    return unwrap(this.groupUseCase.getById(id, businessId));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar grupo de modificadores' })
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateModifierGroupDto,
  ) {
    return unwrap(this.groupUseCase.update({ ...dto, id, businessId, ownerId: req.user.sub }));
  }

  @Post(':id/options')
  @ApiOperation({ summary: 'Agregar opción a grupo' })
  async addOption(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ModifierOptionDto,
  ) {
    return unwrap(this.groupUseCase.addOption({ groupId: id, businessId, ownerId: req.user.sub, option: dto }));
  }

  @Put(':id/options/:optionId')
  @ApiOperation({ summary: 'Actualizar opción' })
  async updateOption(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateModifierOptionDto,
  ) {
    return unwrap(this.groupUseCase.updateOption({ groupId: id, businessId, ownerId: req.user.sub, optionId, updates: dto }));
  }

  @Delete(':id/options/:optionId')
  @ApiOperation({ summary: 'Eliminar opción' })
  async deleteOption(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await unwrap(this.groupUseCase.deleteOption({ groupId: id, businessId, ownerId: req.user.sub, optionId }));
    return { ok: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar grupo de modificadores' })
  async delete(@Param('businessId') businessId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await unwrap(this.groupUseCase.delete({ id, businessId, ownerId: req.user.sub }));
    return { ok: true };
  }
}
