import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { trustProxyHops } from './business/public-board-throttle';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { NEXT_CURSOR_HEADER } from './common/pagination';
import { swaggerEnabled } from './common/runtime-env';

/** Everything the HTTP app needs besides its modules; main.ts and the HTTP tests share it. */
export function configureApp(app: NestExpressApplication, env: NodeJS.ProcessEnv = process.env): void {
  // Behind a proxy (e.g. the hosting platform), use the client IP for rate limiting.
  const hops = trustProxyHops(env);
  if (hops) app.set('trust proxy', hops);

  // gzip responses above the default 1 kB threshold when the client accepts it (S17).
  app.use(compression());

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    // Paginated lists send the next page cursor in a header the browser must be allowed to read.
    exposedHeaders: [NEXT_CURSOR_HEADER],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  if (swaggerEnabled(env)) {
    const config = new DocumentBuilder()
      .setTitle('FUDO Platform API')
      .setDescription('API para réplica de fu.do - Gestión gastronómica')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
}
