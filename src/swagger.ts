import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { getAppEnv } from '@/common/config/runtime-env';

const logger = new Logger('Swagger');

/** @nestjs/swagger CLI 플러그인이 생성한 metadata.ts를 로드한다(있으면). */
async function loadSwaggerPluginMetadata(): Promise<void> {
  try {
    await SwaggerModule.loadPluginMetadata(async () => {
      const metadataModule = await import('./metadata' as string).catch(() => null);

      if (!metadataModule) {
        logger.warn('metadata 모듈을 찾을 수 없어 빈 메타데이터로 동작합니다.');
        return { '@nestjs/swagger': { models: [], controllers: [] } };
      }

      const metadataFactory = metadataModule.default;
      if (typeof metadataFactory === 'function') {
        return metadataFactory();
      }

      return metadataModule as Record<string, unknown>;
    });
  } catch (error) {
    logger.error(`Swagger 플러그인 메타데이터 로드 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const SWAGGER_BEARER_AUTH_SCHEME = 'bearer';

export function createSwaggerDocumentConfig() {
  const appEnv = getAppEnv();

  return new DocumentBuilder()
    .setTitle('Backend Template API')
    .setDescription('Backend Template API 문서')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, SWAGGER_BEARER_AUTH_SCHEME)
    .addServer('/api', `Relative API base (${appEnv})`)
    .addServer('/', `${appEnv} root`)
    .build();
}

export async function setupSwagger(app: INestApplication): Promise<void> {
  await loadSwaggerPluginMetadata();

  const config = createSwaggerDocumentConfig();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs/swagger.json',
    swaggerOptions: {
      withCredentials: true,
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
