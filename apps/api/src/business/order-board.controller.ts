import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { OrderBoardUseCase } from './use-cases/order-board.use-case';

class BarQueueQuery {
  @IsUUID() sucursalId!: string;
}

/** Bar screen and the sucursal's public board token (S13). Status changes use orders/:orderId/status. */
@ApiTags('Barra')
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class OrderBoardController {
  constructor(private readonly orderBoard: OrderBoardUseCase) {}

  @Get('bar-queue')
  @ApiOperation({ summary: 'Cola de barra: pedidos cobrados y abiertos de hoy, por columna' })
  barQueue(@Param('businessId') businessId: string, @Query() query: BarQueueQuery) {
    return unwrap(this.orderBoard.barQueue(businessId, query.sucursalId));
  }

  @Post('sucursales/:sucursalId/display-token')
  @ApiOperation({ summary: 'Generar (o regenerar) el token de la pantalla pública; se muestra una sola vez' })
  generateDisplayToken(@Param('businessId') businessId: string, @Param('sucursalId') sucursalId: string) {
    return unwrap(this.orderBoard.generateDisplayToken(businessId, sucursalId));
  }

  @Delete('sucursales/:sucursalId/display-token')
  @ApiOperation({ summary: 'Desactivar la pantalla pública de la sucursal' })
  disableDisplayToken(@Param('businessId') businessId: string, @Param('sucursalId') sucursalId: string) {
    return unwrap(this.orderBoard.disableDisplayToken(businessId, sucursalId));
  }
}
