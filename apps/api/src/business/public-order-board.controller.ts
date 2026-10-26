import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { unwrap } from '../common/use-case-result';
import { OrderBoardUseCase, PublicOrderBoard } from './use-cases/order-board.use-case';
import { PUBLIC_ORDER_CHECKOUT_THROTTLER, PUBLIC_ORDER_THROTTLER } from './public-board-throttle';

/**
 * Public order board (S13): no session, the secret token in the URL is the only credential.
 * Unknown, disabled and malformed tokens all answer the same 404. Rate limited per client IP
 * (public-board-throttle.ts); the rest of the API is not throttled.
 */
@ApiTags('Pantalla pública')
@Controller('public/order-board')
@UseGuards(ThrottlerGuard)
@SkipThrottle({ [PUBLIC_ORDER_THROTTLER]: true, [PUBLIC_ORDER_CHECKOUT_THROTTLER]: true })
export class PublicOrderBoardController {
  constructor(private readonly orderBoard: OrderBoardUseCase) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Pedidos en preparación y listos de hoy (solo número corto, nombre y estado)' })
  show(@Param('token') token: string): Promise<PublicOrderBoard> {
    return unwrap(this.orderBoard.publicBoard(token));
  }
}
