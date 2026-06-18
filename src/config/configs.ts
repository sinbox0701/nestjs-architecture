import { registerAs } from '@nestjs/config';

import { type Env, envSchema } from './env.schema';

/**
 * 네임스페이스별 typed config.
 *
 * `ConfigModule`의 `load`에 등록되며, 주입 시
 * `@Inject(appConfig.KEY) cfg: ConfigType<typeof appConfig>` 형태로
 * 런타임 타입 안전하게 사용한다.
 *
 * 각 팩토리는 검증·변환된 env를 한 번 더 parse 해 타입을 확정한다.
 * (ConfigModule.validate가 이미 검증하므로 여기선 변환 결과만 취한다.)
 */
function env(): Env {
  return envSchema.parse(process.env);
}

export const appConfig = registerAs('app', () => {
  const e = env();
  return {
    name: e.APP_NAME,
    port: e.APP_PORT,
    url: e.APP_URL,
    corsUrls: e.APP_CORS_URL.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    nodeEnv: e.NODE_ENV,
    appEnv: e.APP_ENV,
    swaggerEnabled: e.SWAGGER_ENABLED,
    logLevel: e.LOG_LEVEL,
    responseDebugDetail: e.RESPONSE_DEBUG_DETAIL,
  };
});

export const securityConfig = registerAs('security', () => {
  const e = env();
  return {
    trustProxy: e.TRUST_PROXY,
    helmetCspEnabled: e.HELMET_CSP_ENABLED,
    compressionEnabled: e.COMPRESSION_ENABLED,
    compressionLevel: e.COMPRESSION_LEVEL,
    compressionThreshold: e.COMPRESSION_THRESHOLD,
  };
});

export const databaseConfig = registerAs('database', () => {
  const e = env();
  return {
    host: e.POSTGRES_HOST,
    port: e.POSTGRES_PORT,
    dbName: e.POSTGRES_DB,
    user: e.POSTGRES_USER,
    password: e.POSTGRES_PASSWORD,
    poolMin: e.MIKRO_ORM_CONNECTION_POOL_MIN,
    poolMax: e.MIKRO_ORM_CONNECTION_POOL_MAX,
    poolIdleTimeout: e.MIKRO_ORM_POOL_IDLE_TIMEOUT,
    debug: e.ORM_DEBUG,
  };
});

export const redisConfig = registerAs('redis', () => {
  const e = env();
  return {
    host: e.REDIS_HOST,
    port: e.REDIS_PORT,
    password: e.REDIS_PASSWORD,
    db: e.REDIS_DB,
    fastRetries: e.REDIS_FAST_RETRIES,
    slowRetryInterval: e.REDIS_SLOW_RETRY_INTERVAL,
    slowRetryLogInterval: e.REDIS_SLOW_RETRY_LOG_INTERVAL,
  };
});

export const authConfig = registerAs('auth', () => {
  const e = env();
  return {
    jwtSecret: e.JWT_SECRET,
    jwtExpiresIn: e.JWT_EXPIRES_IN,
    jwtAlgorithm: e.JWT_ALGORITHM,
    sessionSecret: e.SESSION_SECRET,
    sessionMaxAge: e.SESSION_MAX_AGE,
    maxLoginAttempts: e.AUTH_MAX_LOGIN_ATTEMPTS,
    lockDurationMinutes: e.AUTH_LOCK_DURATION_MINUTES,
    cookieSecure: e.COOKIE_SECURE,
    cookieSameSite: e.COOKIE_SAME_SITE,
    cookieDomain: e.COOKIE_DOMAIN,
  };
});

export const mailConfig = registerAs('mail', () => {
  const e = env();
  return {
    enabled: e.MAIL_ENABLED,
    from: e.MAIL_FROM,
  };
});

export const storageConfig = registerAs('storage', () => {
  const e = env();
  return {
    driver: e.STORAGE_DRIVER,
  };
});

export const otelConfig = registerAs('otel', () => {
  const e = env();
  return {
    enabled: e.OTEL_ENABLED,
    endpoint: e.OTEL_EXPORTER_OTLP_ENDPOINT,
    protocol: e.OTEL_EXPORTER_OTLP_PROTOCOL,
    serviceName: e.OTEL_SERVICE_NAME,
    resourceAttributes: e.OTEL_RESOURCE_ATTRIBUTES,
  };
});

/** ConfigModule.forRoot({ load }) 에 전달할 전체 네임스페이스 목록. */
export const configLoaders = [
  appConfig,
  securityConfig,
  databaseConfig,
  redisConfig,
  authConfig,
  mailConfig,
  storageConfig,
  otelConfig,
];
