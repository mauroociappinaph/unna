import { Body, Controller, Get, Param, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CASH_MOVEMENT_TYPES, CashMovementType, CashSessionStatus } from '@unna/domain';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { PageQuery, pageRequest, sendPage } from '../common/pagination';
import { AuthenticatedRequest } from './authenticated-request';
import { CashUseCase } from './use-cases/cash.use-case';

const SESSION_STATUSES: readonly CashSessionStatus[] = ['open', 'closed'];

class OpenCashSessionDto {
  @IsUUID() sucursalId!: string;
  @IsInt() @Min(0) openingAmount!: number;
}

class CurrentCashSessionQuery {
  @IsUUID() sucursalId!: string;
}

class ListCashSessionsQuery extends PageQuery {
  @IsOptional() @IsUUID() sucursalId?: string;
  @IsOptional() @IsIn(SESSION_STATUSES) status?: CashSessionStatus;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

class CashMovementDto {
  @IsIn(CASH_MOVEMENT_TYPES) type!: CashMovementType;
  @IsInt() @Min(1) amount!: number;
  @IsString() @MinLength(1) @MaxLength(200) reason!: string;
}

/** Counted amounts per payment method, in cents; a missing method counts as 0. */
class DeclaredAmountsDto {
  @IsOptional() @IsInt() @Min(0) cash?: number;
  @IsOptional() @IsInt() @Min(0) card?: number;
  @IsOptional() @IsInt() @Min(0) mercado_pago?: number;
  @IsOptional() @IsInt() @Min(0) transfer?: number;
  @IsOptional() @IsInt() @Min(0) qr?: number;
}

class CloseCashSessionDto {
  @ValidateNested() @Type(() => DeclaredAmountsDto) declared!: DeclaredAmountsDto;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

@ApiTags('Caja')
@Controller('businesses/:businessId/cash-sessions')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class CashController {
  constructor(private readonly cash: CashUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Abrir caja en una sucursal (una abierta por sucursal)' })
  open(@Param('businessId') businessId: string, @Body() dto: OpenCashSessionDto, @Request() req: AuthenticatedRequest) {
    return unwrap(this.cash.open({ businessId, ...dto, openedBy: req.user.sub }));
  }

  @Get('current')
  @ApiOperation({ summary: 'Caja abierta de la sucursal ({ session: null } si no hay)' })
  async current(@Param('businessId') businessId: string, @Query() query: CurrentCashSessionQuery) {
    return { session: await unwrap(this.cash.current(businessId, query.sucursalId)) };
  }

  @Get()
  @ApiOperation({ summary: 'Listar cajas, más recientes primero, sin movimientos (movementCount); cursor siguiente en X-Next-Cursor' })
  list(@Param('businessId') businessId: string, @Query() query: ListCashSessionsQuery, @Res({ passthrough: true }) res: Response) {
    const filters = {
      sucursalId: query.sucursalId,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
    return sendPage(res, unwrap(this.cash.list(businessId, filters, pageRequest(query))));
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Obtener caja con movimientos y, si está cerrada, esperado/declarado/diferencia' })
  get(@Param('businessId') businessId: string, @Param('sessionId') sessionId: string) {
    return unwrap(this.cash.get(businessId, sessionId));
  }

  @Post(':sessionId/movements')
  @ApiOperation({ summary: 'Registrar ingreso o retiro de efectivo' })
  addMovement(
    @Param('businessId') businessId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CashMovementDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return unwrap(this.cash.addMovement({ businessId, sessionId, ...dto, createdBy: req.user.sub }));
  }

  @Post(':sessionId/close')
  @ApiOperation({ summary: 'Cerrar caja con lo contado por medio de pago' })
  close(
    @Param('businessId') businessId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CloseCashSessionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return unwrap(this.cash.close({ businessId, sessionId, declared: dto.declared, notes: dto.notes, closedBy: req.user.sub }));
  }
}
