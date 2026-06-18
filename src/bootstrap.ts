import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';

import { BadRequestException } from '@/common/exceptions';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { FrameworkLogger } from './core/logger/framework-logger';

export async function bootstrap(): Promise<INestApplication> {
  const logger = new FrameworkLogger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger,
  });

  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  const corsUrls: string[] = configService.get<string>('APP_CORS_URL')?.split(',') || [];
  app.enableCors({
    origin: corsUrls,
    credentials: true,
    exposedHeaders: ['authorization', 'x-server-token', 'x-trace-id'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });

  app.useGlobalFilters(new HttpExceptionFilter(configService));

  app.set('query parser', 'extended');

  // ============================================================
  // Security & Performance Middleware
  // ============================================================

  // Trust Proxy
  const trustProxy = configService.get<boolean | number | string>('TRUST_PROXY', false);
  if (trustProxy === false || trustProxy === 'false') {
    app.set('trust proxy', false);
  } else if (trustProxy === true || trustProxy === 'true') {
    logger.warn('trust proxy: true is not recommended! Consider specifying exact proxy count or IP.');
    app.set('trust proxy', true);
  } else if (typeof trustProxy === 'number' || !isNaN(Number(trustProxy))) {
    app.set('trust proxy', Number(trustProxy));
  } else {
    app.set('trust proxy', trustProxy);
  }

  // Helmet (보안 헤더)
  const helmetCspEnabled = configService.get<boolean>('HELMET_CSP_ENABLED', true);
  app.use(
    helmet({
      contentSecurityPolicy: helmetCspEnabled
        ? {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              fontSrc: ["'self'", 'https:', 'data:'],
              formAction: ["'self'"],
              frameAncestors: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              objectSrc: ["'none'"],
              scriptSrc: ["'self'"],
              scriptSrcAttr: ["'none'"],
              styleSrc: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Swagger 경로는 CSP 예외 처리
  if (helmetCspEnabled && configService.get<boolean>('SWAGGER_ENABLED', true)) {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api/docs')) {
        res.removeHeader('Content-Security-Policy');
      }
      next();
    });
  }

  // Compression (gzip/deflate)
  const compressionEnabled = configService.get<boolean>('COMPRESSION_ENABLED', true);
  if (compressionEnabled) {
    app.use(
      compression({
        level: parseInt(configService.get<string>('COMPRESSION_LEVEL', '6'), 10),
        threshold: parseInt(configService.get<string>('COMPRESSION_THRESHOLD', '1024'), 10),
        filter: (req, res) => {
          if (req.headers.accept === 'text/event-stream') return false;
          return compression.filter(req, res);
        },
      }),
    );
  }

  // Cookie Parser
  app.use(cookieParser());

  // Body Parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ============================================================
  // Validation Pipe
  // ============================================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const entries: { path: string; message: string }[] = [];
        const extract = (errs: ValidationError[], parentPath = ''): void => {
          for (const error of errs) {
            const path = parentPath ? `${parentPath}.${error.property}` : error.property;
            for (const msg of Object.values(error.constraints ?? {})) {
              entries.push({ path, message: msg });
            }
            extract(error.children ?? [], path);
          }
        };
        extract(errors);

        const grouped = new Map<string, string[]>();
        for (const { path, message } of entries) {
          const paths = grouped.get(message) ?? [];
          paths.push(path);
          grouped.set(message, paths);
        }

        const result = [...grouped.entries()].map(([msg, paths]) => `[${paths.join(', ')}] ${msg}`).join('; ');
        return new BadRequestException(result);
      },
    }),
  );

  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', true);
  if (swaggerEnabled) {
    await import('./swagger').then(({ setupSwagger }) => setupSwagger(app));
  }

  app.enableShutdownHooks();

  const port = configService.get<number>('APP_PORT', 3000);
  await app.listen(port, () => {
    logger.log(`Application is running on http://0.0.0.0:${port}`);
  });

  return app;
}
