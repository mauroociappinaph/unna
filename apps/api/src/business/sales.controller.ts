import { Body, Controller, Delete, Get, Param, Post, Query, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { dateQuery, INVALID_DATE } from '../common/date-query';
import { unwrap } from '../common/use-case-result';
import { PageQuery, pageRequest, sendPage } from '../common/pagination';
import { ORDER_ACTIONS, ORDER_TYPES, PAYMENT_METHODS, SalesUseCase } from './use-cases/sales.use-case';
import { FiscalAuthorizerUnavailableError, InvoicingUseCase, IssuableReceiptType, RECEIPT_TYPES } from './use-cases/invoicing.use-case';

class SelectedModifierDto {
  @IsUUID() modifierGroupId!: string;
  @IsUUID() optionId!: string;
}

class OrderLineDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SelectedModifierDto) modifiers?: SelectedModifierDto[];
}

class CreateOrderDto {
  @IsUUID() sucursalId!: string;
  @IsIn(ORDER_TYPES) type!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderLineDto) items!: OrderLineDto[];
  @IsOptional() @IsString() @MaxLength(20) tableNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) customerName?: string;
  @IsOptional() @IsString() @MaxLength(30) customerPhone?: string;
  @IsOptional() @IsEmail() customerEmail?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

class DiscountDto {
  @IsInt() @Min(0) amount!: number;
}

class ChangeStatusDto {
  @IsIn(ORDER_ACTIONS) action!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

class RegisterPaymentDto {
  @IsInt() @Min(1) amount!: number;
  @IsIn(PAYMENT_METHODS) method!: string;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}

class IssueReceiptDto {
  @IsIn(RECEIPT_TYPES) type!: IssuableReceiptType;
  @IsOptional() @IsString() @MaxLength(100) customerName?: string;
  @IsOptional() @IsString() @MaxLength(20) customerTaxId?: string;
  @IsOptional() @IsString() @MaxLength(40) customerCondition?: string;
}

class ListOrdersQuery extends PageQuery {
  @IsOptional() @IsString() status?: string;
  /** "true": only orders that are not closed (delivered, cancelled, refunded). */
  @IsOptional() @IsIn(['true', 'false']) open?: string;
  @IsOptional() @IsUUID() sucursalId?: string;
  @IsOptional() @IsDateString({}, { message: INVALID_DATE }) from?: string;
  @IsOptional() @IsDateString({}, { message: INVALID_DATE }) to?: string;
}

@ApiTags('Ventas / POS')
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(
    private readonly sales: SalesUseCase,
    private readonly invoicing: InvoicingUseCase,
  ) {}

  @Post('orders')
  @ApiOperation({ summary: 'Crear pedido (precios tomados del catálogo)' })
  createOrder(@Param('businessId') businessId: string, @Body() dto: CreateOrderDto) {
    return unwrap(this.sales.createOrder({ ...dto, businessId }));
  }

  @Get('orders')
  @ApiOperation({ summary: 'Listar pedidos, más recientes primero, sin ítems (itemCount); cursor siguiente en X-Next-Cursor' })
  listOrders(@Param('businessId') businessId: string, @Query() query: ListOrdersQuery, @Res({ passthrough: true }) res: Response) {
    const filters = {
      status: query.status,
      open: query.open === 'true',
      sucursalId: query.sucursalId,
      from: dateQuery(query.from),
      to: dateQuery(query.to),
    };
    return sendPage(res, unwrap(this.sales.listOrders(businessId, filters, pageRequest(query))));
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Obtener pedido' })
  getOrder(@Param('businessId') businessId: string, @Param('orderId') orderId: string) {
    return unwrap(this.sales.getOrder(businessId, orderId));
  }

  @Post('orders/:orderId/items')
  @ApiOperation({ summary: 'Agregar item a un pedido abierto' })
  addItem(@Param('businessId') businessId: string, @Param('orderId') orderId: string, @Body() dto: OrderLineDto) {
    return unwrap(this.sales.addItem({ businessId, orderId, line: dto }));
  }

  @Delete('orders/:orderId/items/:itemId')
  @ApiOperation({ summary: 'Quitar item de un pedido abierto' })
  removeItem(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return unwrap(this.sales.removeItem({ businessId, orderId, itemId }));
  }

  @Post('orders/:orderId/discount')
  @ApiOperation({ summary: 'Aplicar descuento en centavos (0 lo quita)' })
  applyDiscount(@Param('businessId') businessId: string, @Param('orderId') orderId: string, @Body() dto: DiscountDto) {
    return unwrap(this.sales.applyDiscount({ businessId, orderId, amount: dto.amount }));
  }

  @Post('orders/:orderId/status')
  @ApiOperation({ summary: 'Cambiar estado: confirm, prepare, ready, deliver, cancel' })
  changeStatus(@Param('businessId') businessId: string, @Param('orderId') orderId: string, @Body() dto: ChangeStatusDto) {
    return unwrap(this.sales.changeStatus({ businessId, orderId, action: dto.action, reason: dto.reason }));
  }

  @Post('orders/:orderId/payments')
  @ApiOperation({ summary: 'Registrar pago (admite pagos parciales / split)' })
  registerPayment(@Param('businessId') businessId: string, @Param('orderId') orderId: string, @Body() dto: RegisterPaymentDto) {
    return unwrap(this.sales.registerPayment({ businessId, orderId, ...dto }));
  }

  @Get('orders/:orderId/payments')
  @ApiOperation({ summary: 'Listar pagos de un pedido' })
  listPayments(@Param('businessId') businessId: string, @Param('orderId') orderId: string) {
    return unwrap(this.sales.listPayments({ businessId, orderId }));
  }

  @Post('orders/:orderId/receipts')
  @ApiOperation({ summary: 'Emitir comprobante: ticket al instante; A/B/C con CAE de ARCA (si ARCA rechaza o falla queda en borrador para reintentar)' })
  async issueReceipt(@Param('businessId') businessId: string, @Param('orderId') orderId: string, @Body() dto: IssueReceiptDto) {
    const result = await this.invoicing.issueReceipt(businessId, orderId, dto);
    // ARCA not answering is not the client's fault: 503, the draft stays to retry.
    if (result.error instanceof FiscalAuthorizerUnavailableError) throw new ServiceUnavailableException(result.error.message);
    return unwrap(Promise.resolve(result));
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Listar comprobantes, más recientes primero, sin ítems (itemCount); cursor siguiente en X-Next-Cursor' })
  listReceipts(@Param('businessId') businessId: string, @Query() query: PageQuery, @Res({ passthrough: true }) res: Response) {
    return sendPage(res, unwrap(this.invoicing.listReceipts(businessId, pageRequest(query))));
  }

  @Get('receipts/:receiptId')
  @ApiOperation({ summary: 'Obtener comprobante' })
  getReceipt(@Param('businessId') businessId: string, @Param('receiptId') receiptId: string) {
    return unwrap(this.invoicing.getReceipt(businessId, receiptId));
  }
}
