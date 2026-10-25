import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardBusinessUseCase, OnboardBusinessCommand } from './use-cases/onboard-business.use-case';
import { BusinessManagementUseCase, SUCURSAL_NOT_FOUND } from './use-cases/business-management.use-case';
import { BusinessView, toBusinessView } from './business.presenter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsNotEmpty, ValidateNested, IsArray, ArrayMinSize, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import type { AuthenticatedRequest } from './authenticated-request';

class AddressDto {
  @IsString() @IsNotEmpty() street!: string;
  @IsString() @IsNotEmpty() number!: string;
  @IsString() @IsOptional() floor?: string;
  @IsString() @IsOptional() apartment?: string;
  @IsString() @IsOptional() neighborhood?: string;
  @IsString() @IsNotEmpty() city!: string;
  @IsString() @IsNotEmpty() province!: string;
  @IsString() @IsNotEmpty() postalCode!: string;
  @IsString() @IsNotEmpty() country!: string;
}

class DayScheduleDto {
  @IsString() @IsNotEmpty() open!: string;
  @IsString() @IsNotEmpty() close!: string;
  @IsNotEmpty() isClosed!: boolean;
}

class WeekScheduleDto {
  @ValidateNested() @Type(() => DayScheduleDto) monday!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) tuesday!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) wednesday!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) thursday!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) friday!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) saturday!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) sunday!: DayScheduleDto;
}

class SettingsDto {
  @IsString() @IsNotEmpty() tradeName!: string;
  @IsString() @IsOptional() legalName?: string;
  @IsString() @IsNotEmpty() ivaCondition!: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';
  @IsString() @IsOptional() iibbNumber?: string;
  @IsString() @IsNotEmpty() salePoint!: string;
  @IsString() @IsNotEmpty() currency!: 'ARS' | 'USD';
  @IsString() @IsNotEmpty() timezone!: string;
  @IsString() @IsNotEmpty() language!: string;
  @IsString() @IsOptional() logoUrl?: string;
}

class SucursalDto {
  @IsString() @IsNotEmpty() name!: string;
  @ValidateNested() @Type(() => AddressDto) address!: AddressDto;
  @IsString() @IsNotEmpty() phone!: string;
  @IsString() @IsNotEmpty() email!: string;
  @ValidateNested() @Type(() => WeekScheduleDto) @IsOptional() schedule?: WeekScheduleDto;
  @IsOptional() isMain?: boolean;
}

export class OnboardBusinessDto {
  @IsString() @IsNotEmpty() businessName!: string;
  @IsString() @IsNotEmpty() cuit!: string;
  @ValidateNested() @Type(() => AddressDto) address!: AddressDto;
  @ValidateNested() @Type(() => WeekScheduleDto) schedule!: WeekScheduleDto;
  @ValidateNested() @Type(() => SettingsDto) settings!: SettingsDto;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SucursalDto) sucursales!: SucursalDto[];
}

// DTOs for BusinessManagementUseCase
export class UpdateSettingsDto {
  @IsString() @IsOptional() tradeName?: string;
  @IsString() @IsOptional() legalName?: string;
  @IsString() @IsOptional() ivaCondition?: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';
  @IsString() @IsOptional() iibbNumber?: string;
  @IsString() @IsOptional() salePoint?: string;
  @IsString() @IsOptional() currency?: 'ARS' | 'USD';
  @IsString() @IsOptional() timezone?: string;
  @IsString() @IsOptional() language?: string;
  @IsString() @IsOptional() logoUrl?: string;
}

export class ManageSucursalDto {
  @IsString() @IsNotEmpty() action!: 'create' | 'update' | 'delete';
  @IsUUID() @IsOptional() id?: string; // required for update/delete
  @IsString() @IsNotEmpty() name!: string;
  @ValidateNested() @Type(() => AddressDto) address!: AddressDto;
  @IsString() @IsNotEmpty() phone!: string;
  @IsString() @IsNotEmpty() email!: string;
  @ValidateNested() @Type(() => WeekScheduleDto) @IsOptional() schedule?: WeekScheduleDto;
  @IsOptional() isMain?: boolean;
  @IsOptional() isActive?: boolean;
}

export class ManageHorariosDto {
  @IsString() @IsNotEmpty() sucursalId!: string; // 'main' or sucursal UUID
  @ValidateNested() @Type(() => WeekScheduleDto) schedule!: WeekScheduleDto;
}

@ApiTags('Business')
@Controller('businesses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BusinessController {
  constructor(
    private readonly onboardBusinessUseCase: OnboardBusinessUseCase,
    private readonly businessManagementUseCase: BusinessManagementUseCase,
  ) {}

  // --- Onboarding ---
  @Post()
  @ApiOperation({ summary: 'Crear nuevo negocio para el usuario autenticado (onboarding completo)' })
  async onboard(@Request() req: AuthenticatedRequest, @Body() dto: OnboardBusinessDto) {
    const command: OnboardBusinessCommand = {
      ownerId: req.user.sub,
      businessName: dto.businessName,
      cuit: dto.cuit,
      address: dto.address,
      schedule: dto.schedule,
      settings: dto.settings,
      sucursales: dto.sucursales,
    };

    const result = await this.onboardBusinessUseCase.execute(command);

    if (!result.ok) {
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  // --- Business Settings ---
  @Patch(':id/settings')
  @ApiOperation({ summary: 'Actualizar configuración del negocio' })
  async updateSettings(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateSettingsDto,
  ) {
    const result = await this.businessManagementUseCase.updateSettings({
      businessId: id,
      ownerId: req.user.sub,
      settings: dto,
    });

    if (!result.ok) {
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  @Patch(':id/address')
  @ApiOperation({ summary: 'Actualizar dirección del negocio' })
  async updateAddress(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddressDto,
  ) {
    const result = await this.businessManagementUseCase.updateAddress({
      businessId: id,
      ownerId: req.user.sub,
      address: dto,
    });

    if (!result.ok) {
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Actualizar horario del negocio (nivel business)' })
  async updateSchedule(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: WeekScheduleDto,
  ) {
    const result = await this.businessManagementUseCase.updateSchedule({
      businessId: id,
      ownerId: req.user.sub,
      schedule: dto,
    });

    if (!result.ok) {
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  // --- Sucursal Management ---
  @Post(':id/sucursales')
  @ApiOperation({ summary: 'Crear nueva sucursal' })
  async createSucursal(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ManageSucursalDto,
  ) {
    const result = await this.businessManagementUseCase.manageSucursal({
      businessId: id,
      ownerId: req.user.sub,
      action: 'create',
      sucursal: dto,
    });

    if (!result.ok) {
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  @Put(':id/sucursales/:sucursalId')
  @ApiOperation({ summary: 'Actualizar sucursal existente' })
  async updateSucursal(
    @Param('id') id: string,
    @Param('sucursalId') sucursalId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ManageSucursalDto,
  ) {
    const result = await this.businessManagementUseCase.manageSucursal({
      businessId: id,
      ownerId: req.user.sub,
      action: 'update',
      sucursal: { ...dto, id: sucursalId },
    });

    if (!result.ok) {
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  @Delete(':id/sucursales/:sucursalId')
  @ApiOperation({ summary: 'Eliminar sucursal' })
  async deleteSucursal(
    @Param('id') id: string,
    @Param('sucursalId') sucursalId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.businessManagementUseCase.manageSucursal({
      businessId: id,
      ownerId: req.user.sub,
      action: 'delete',
      sucursal: { id: sucursalId, name: '', address: { street: '', number: '', city: '', province: '', postalCode: '', country: '' }, phone: '', email: '' },
    });

    if (!result.ok) {
      if (result.error.message === SUCURSAL_NOT_FOUND) throw new NotFoundException(SUCURSAL_NOT_FOUND);
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  // --- Schedule Management (business or sucursal) ---
  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Actualizar horario (business o sucursal)' })
  async manageHorarios(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ManageHorariosDto,
  ) {
    const result = await this.businessManagementUseCase.manageHorarios({
      businessId: id,
      ownerId: req.user.sub,
      sucursalId: dto.sucursalId,
      schedule: dto.schedule,
    });

    if (!result.ok) {
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  // --- Getters ---
  @Get()
  @ApiOperation({ summary: 'Listar negocios del usuario autenticado' })
  async findMine(@Request() req: AuthenticatedRequest): Promise<BusinessView[]> {
    const businesses = await this.businessManagementUseCase.listMine(req.user.sub);
    return businesses.map(toBusinessView);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener negocio por ID' })
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<BusinessView> {
    const result = await this.businessManagementUseCase.getMine(id, req.user.sub);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return toBusinessView(result.value);
  }
}