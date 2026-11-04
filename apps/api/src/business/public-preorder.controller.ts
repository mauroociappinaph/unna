import { Body, Controller, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { unwrap } from '../common/use-case-result';
import { CreatePreorderCheckoutDto } from './dto/preorder-checkout.dto';
import { PUBLIC_BOARD_THROTTLER, PUBLIC_ORDER_CHECKOUT_THROTTLER, PUBLIC_ORDER_THROTTLER } from './public-board-throttle';
import { CreatedCheckout, OnlineCheckoutUseCase } from './use-cases/online-checkout.use-case';
import { PreorderTrackingView, OrderTrackingUseCase } from './use-cases/order-tracking.use-case';
import { PublicMenu, PublicMenuUseCase } from './use-cases/public-menu.use-case';

/**
 * Public pedido anticipado (S20): menu of a sucursal's link, checkout and tracking page. No session:
 * the slug (not guessable) and the tracking token (secret) are the only credentials, and unknown
 * ones answer a generic 404. Rate limited per client IP and route (public-board-throttle.ts): reads
 * with `public-order`, checkout creations with `public-order-checkout`.
 */
@ApiTags('Pedido anticipado')
@Controller('public/pedido')
@UseGuards(ThrottlerGuard)
@SkipThrottle({ [PUBLIC_BOARD_THROTTLER]: true, [PUBLIC_ORDER_CHECKOUT_THROTTLER]: true })
export class PublicPreorderController {
  constructor(
    private readonly menus: PublicMenuUseCase,
    private readonly checkouts: OnlineCheckoutUseCase,
    private readonly tracking: OrderTrackingUseCase,
  ) {}

  @Get('seguimiento/:trackingToken')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Seguimiento del pedido (se sincroniza con Mercado Pago mientras espera el pago)' })
  track(@Param('trackingToken') trackingToken: string): Promise<PreorderTrackingView> {
    return unwrap(this.tracking.track(trackingToken));
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Menú del local y si está tomando pedidos' })
  menu(@Param('slug') slug: string): Promise<PublicMenu> {
    return unwrap(this.menus.menu(slug));
  }

  @Post(':slug/checkouts')
  @Header('Cache-Control', 'no-store')
  @SkipThrottle({ [PUBLIC_ORDER_THROTTLER]: true, [PUBLIC_ORDER_CHECKOUT_THROTTLER]: false })
  @ApiOperation({ summary: 'Crear el pago online del pedido (el pedido se crea cuando el pago se aprueba)' })
  checkout(@Param('slug') slug: string, @Body() body: CreatePreorderCheckoutDto): Promise<CreatedCheckout> {
    return unwrap(this.checkouts.create(slug, body));
  }
}
