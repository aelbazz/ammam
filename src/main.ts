import { join } from 'path';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';
import { buildAppConfig } from './config/configuration';
import { EnvironmentVariables } from './config/env.validation';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const config = buildAppConfig({
    NODE_ENV: configService.get('NODE_ENV'),
    PORT: configService.get('PORT'),
    DATABASE_URL: configService.get('DATABASE_URL'),
    JWT_SECRET: configService.get('JWT_SECRET'),
    JWT_EXPIRES_IN: configService.get('JWT_EXPIRES_IN'),
    CORS_ORIGINS: configService.get('CORS_ORIGINS'),
    THROTTLE_TTL_SECONDS: configService.get('THROTTLE_TTL_SECONDS'),
    THROTTLE_LIMIT: configService.get('THROTTLE_LIMIT'),
    AUTH_THROTTLE_LIMIT: configService.get('AUTH_THROTTLE_LIMIT'),
    SWAGGER_ENABLED: configService.get('SWAGGER_ENABLED'),
    API_PUBLIC_URL: configService.get('API_PUBLIC_URL'),
    FRONTEND_PUBLIC_URL: configService.get('FRONTEND_PUBLIC_URL'),
  } as EnvironmentVariables);

  if (
    config.isProduction &&
    (!configService.get('API_PUBLIC_URL') || !configService.get('FRONTEND_PUBLIC_URL'))
  ) {
    // Silently falling back to the localhost defaults in production would build broken
    // avatar/public-site URLs that only fail once a real client clicks them.
    throw new Error('API_PUBLIC_URL and FRONTEND_PUBLIC_URL must both be set in production.');
  }

  // Serves both the committed default avatar (public/assets/default-avatar.svg) and
  // runtime-uploaded ones (public/uploads/avatars/...) - see StorageService.
  app.useStaticAssets(join(process.cwd(), 'public'));

  // -- security ---------------------------------------------------------------

  app.use(
    helmet({
      // The API serves JSON to a separate origin; a restrictive CSP on JSON responses adds
      // nothing, but cross-origin resource policy must allow the GitHub Pages frontend.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Request size limits: the largest legitimate admin payload is one experience with its
  // children, comfortably under 100 KB.
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: true, limit: '256kb' }));

  const wildcard = config.corsOrigins.some((o) => o === '*');
  if (wildcard && config.isProduction) {
    // Refuse to start rather than silently serving the API to every origin.
    throw new Error('CORS_ORIGINS must not contain "*" in production.');
  }

  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match', 'If-Modified-Since'],
    exposedHeaders: ['ETag', 'Last-Modified', 'X-Tenant-Slug-Current'],
    credentials: false,
    maxAge: 86_400,
  });

  // -- routing and validation -------------------------------------------------

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Constraint messages describe the rule, never echo the submitted value, so a
      // rejected login body cannot put a password into a response or a log.
      disableErrorMessages: false,
    }),
  );

  // -- swagger ----------------------------------------------------------------

  if (config.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Profile API')
      .setDescription(
        'Backend for the Angular profile/portfolio site.\n\n' +
          '`GET /api/v1/public/profile` is the single endpoint the public frontend uses. ' +
          'Everything that mutates data requires a bearer token from `POST /api/v1/auth/login`.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'bearer',
      )
      .addTag('public', 'Anonymous read access for the frontend')
      .addTag('auth', 'Administrator authentication')
      .addTag('health', 'Liveness and readiness')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // -- lifecycle --------------------------------------------------------------

  app.enableShutdownHooks();
  app.get(PrismaService).enableShutdownHooks(app);

  await app.listen(config.port, '0.0.0.0');

  logger.log(`Listening on port ${config.port} (${config.nodeEnv})`);
  logger.log(`Public profile: /api/v1/public/profile`);
  if (config.swaggerEnabled) logger.log(`Swagger: /api/docs`);
  logger.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
}

void bootstrap();
