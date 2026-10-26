import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Liveness for the hosting platform (S17): answers as soon as Nest is listening, without touching
 * the database, without a token and without rate limiting.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check liviano (sin base de datos)' })
  check() {
    return { status: 'ok' };
  }
}
