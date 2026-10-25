import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardBusinessUseCase, OnboardBusinessCommand } from './use-cases/onboard-business.use-case';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsNotEmpty, ValidateNested, IsArray, ArrayMinSize, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

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

@ApiTags('Business')
@Controller('businesses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BusinessController {
  constructor(private readonly onboardBusinessUseCase: OnboardBusinessUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo negocio para el usuario autenticado (onboarding completo)' })
  async onboard(@Request() req: any, @Body() dto: OnboardBusinessDto) {
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
      const { HttpException, HttpStatus } = require('@nestjs/common');
      throw new HttpException(result.error.message, HttpStatus.BAD_REQUEST);
    }

    return result.value;
  }

  @Get()
  @ApiOperation({ summary: 'Listar negocios del usuario autenticado' })
  async findMine(@Request() req: any) {
    // TODO: implement using repository
    return [];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener negocio por ID' })
  async findOne(@Param('id') id: string) {
    // TODO: implement using repository
    return { id };
  }
}