import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardBusinessUseCase, OnboardBusinessCommand } from './use-cases/onboard-business.use-case';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

export class OnboardBusinessDto {
  businessName!: string;
}

@ApiTags('Business')
@Controller('businesses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BusinessController {
  constructor(private readonly onboardBusinessUseCase: OnboardBusinessUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo negocio para el usuario autenticado' })
  async onboard(@Request() req: any, @Body() dto: OnboardBusinessDto) {
    const result = await this.onboardBusinessUseCase.execute({
      ownerId: req.user.sub,
      businessName: dto.businessName,
    });

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