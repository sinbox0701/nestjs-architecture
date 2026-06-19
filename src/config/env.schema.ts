import { z } from 'zod';

/**
 * 환경 변수 스키마 (zod 기반 typed config).
 *
 * camp-backend의 Joi `.required().allow('')` 안티패턴을 제거한다.
 * - 빈 문자열을 허용하지 않는다(`''`은 "값이 있다"가 아니라 "누락"으로 취급).
 * - 모든 키는 명시적 default 또는 필수 여부를 갖는다.
 * - boolean/number는 문자열 env에서 강제 변환(coerce)한다.
 * - 부팅 시 1회 parse → 런타임 타입 안전 확보.
 *
 * 도메인 특화 키(S3/미디어/외부 API 등)는 스타터에 포함하지 않는다.
 * 도메인 단계에서 이 스키마를 확장한다.
 */

const booleanFromEnv = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const trustProxySchema = z
  .union([z.boolean(), z.string(), z.number()])
  .default(false)
  .transform((v) => {
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    const n = Number(v);
    return Number.isFinite(n) ? n : String(v);
  });

const baseEnvSchema = z.object({
  // ── Runtime ──
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  APP_ENV: z.enum(['dev', 'stage', 'prod']).default('dev'),
  TZ: z.string().min(1).default('Etc/UTC'),
  PGTZ: z.string().min(1).default('UTC'),

  // ── Application ──
  APP_NAME: z.string().min(1).default('backend-template'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().default('http://localhost:3000'),
  APP_CORS_URL: z.string().default('http://localhost:3000'),
  SWAGGER_ENABLED: booleanFromEnv.default(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  RESPONSE_DEBUG_DETAIL: booleanFromEnv.default(false),

  // ── Security & Middleware ──
  TRUST_PROXY: trustProxySchema,
  HELMET_CSP_ENABLED: booleanFromEnv.default(true),
  COMPRESSION_ENABLED: booleanFromEnv.default(true),
  COMPRESSION_LEVEL: z.coerce.number().int().min(1).max(9).default(6),
  COMPRESSION_THRESHOLD: z.coerce.number().int().min(0).default(1024),

  // ── Database (PostgreSQL) ──
  POSTGRES_HOST: z.string().min(1).default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1).default('backend_template'),
  POSTGRES_USER: z.string().min(1).default('user'),
  POSTGRES_PASSWORD: z.string().min(1).default('changeme'),
  MIKRO_ORM_CONNECTION_POOL_MIN: z.coerce.number().int().min(0).default(2),
  MIKRO_ORM_CONNECTION_POOL_MAX: z.coerce.number().int().min(1).default(10),
  MIKRO_ORM_POOL_IDLE_TIMEOUT: z.coerce.number().int().min(1000).default(30000),
  ORM_DEBUG: booleanFromEnv.default(false),

  // ── Redis ──
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
  REDIS_FAST_RETRIES: z.coerce.number().int().min(0).default(5),
  REDIS_SLOW_RETRY_INTERVAL: z.coerce.number().int().min(0).default(30000),
  // 장기 재연결 중 로그를 남길 시도 횟수 간격(N회마다 1회). slowRetryInterval와 함께 동작.
  REDIS_SLOW_RETRY_LOG_INTERVAL: z.coerce.number().int().min(1).default(10),
  // Redis를 "필수 의존성"으로 둘지 여부. true면 부팅 시 연결 실패가 앱 시작을 막는다.
  // refresh token/blocklist/session을 Redis에 두는 도메인은 stage/prod에서 true 권장.
  REDIS_REQUIRED: booleanFromEnv.default(false),

  // ── Cookie ──
  COOKIE_SECURE: booleanFromEnv.default(false),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().default(''),

  // ── Auth / Session (제네릭) ──
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),
  JWT_EXPIRES_IN: z.string().min(1).default('1h'),
  // 서명/검증 알고리즘. 대칭 JWT_SECRET 기반이므로 HMAC 계열만 허용한다.
  // 비대칭(RS/ES)으로 전환하려면 키 쌍 설정과 함께 이 enum을 확장해야 한다.
  JWT_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512']).default('HS256'),
  // Refresh Token: AT와 분리된 시크릿/수명. RT는 Redis에 저장되어 rotation/재사용 탐지된다.
  REFRESH_TOKEN_SECRET: z.string().min(1).default('change-me-in-production'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1).default('7d'),
  SESSION_SECRET: z.string().min(1).default('change-me-in-production'),
  SESSION_MAX_AGE: z.coerce.number().int().min(0).default(86400000),
  AUTH_MAX_LOGIN_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  AUTH_LOCK_DURATION_MINUTES: z.coerce.number().int().min(0).default(30),

  // ── Mail (골격: 기본 비활성. 도메인 단계에서 provider 연결) ──
  MAIL_ENABLED: booleanFromEnv.default(false),
  MAIL_FROM: z.string().default('no-reply@localhost'),

  // ── Storage (골격: 기본 no-op 드라이버) ──
  STORAGE_DRIVER: z.enum(['noop', 's3']).default('noop'),

  // ── Observability (OpenTelemetry) ──
  OTEL_ENABLED: booleanFromEnv.default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(''),
  OTEL_EXPORTER_OTLP_PROTOCOL: z.enum(['grpc', 'http/protobuf']).default('http/protobuf'),
  OTEL_SERVICE_NAME: z.string().min(1).default('backend-template'),
  OTEL_RESOURCE_ATTRIBUTES: z.string().default(''),
});

/**
 * 환경 안전성 게이트 (prod/stage 강제).
 *
 * zod 기본 스키마는 "형태"만 검증한다. 형태가 맞아도 prod에 약한 시크릿/디버그
 * 설정이 그대로 배포되면 사고가 난다. 아래 superRefine은 APP_ENV이 prod/stage일 때
 * 안전하지 않은 조합을 부팅 시점에 거부한다.
 */
const DEFAULT_SECRET = 'change-me-in-production';
const MIN_SECRET_LENGTH = 32;

function isWeakSecret(secret: string): boolean {
  return secret === DEFAULT_SECRET || secret.length < MIN_SECRET_LENGTH;
}

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  // 환경 무관: SameSite=None 쿠키는 브라우저가 Secure 없이는 거부한다.
  if (env.COOKIE_SAME_SITE === 'none' && !env.COOKIE_SECURE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['COOKIE_SECURE'],
      message: 'COOKIE_SAME_SITE=none이면 COOKIE_SECURE=true여야 합니다(브라우저가 Secure 없는 None 쿠키를 거부).',
    });
  }

  const hardened = env.APP_ENV === 'prod' || env.APP_ENV === 'stage';
  if (!hardened) return;

  // 1. 시크릿: 기본값 금지 + 최소 길이. 세 HS256 시크릿(AT/RT/세션) 전부 검사.
  for (const key of ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'SESSION_SECRET'] as const) {
    if (isWeakSecret(env[key])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${env.APP_ENV} 환경에서는 기본/약한 시크릿을 쓸 수 없습니다 (기본값 금지, 최소 ${MIN_SECRET_LENGTH}자). \`openssl rand -hex 32\`로 생성하세요.`,
      });
    }
  }

  // 1-1. AT/RT 시크릿 분리 강제: 같으면 시크릿 분리(rotation/blocklist 격리)가 무력화된다.
  if (env.JWT_SECRET === env.REFRESH_TOKEN_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REFRESH_TOKEN_SECRET'],
      message: 'REFRESH_TOKEN_SECRET은 JWT_SECRET과 달라야 합니다(AT/RT 시크릿 분리).',
    });
  }

  // 1-2. 디버그 응답(stack/요청 body/내부 메시지 노출)은 prod/stage에서 금지.
  if (env.RESPONSE_DEBUG_DETAIL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESPONSE_DEBUG_DETAIL'],
      message: `${env.APP_ENV} 환경에서는 RESPONSE_DEBUG_DETAIL=false여야 합니다(stack/요청 본문 노출 방지).`,
    });
  }

  // 2. 쿠키: prod/stage는 Secure 필수(HTTPS 전송).
  if (!env.COOKIE_SECURE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['COOKIE_SECURE'],
      message: `${env.APP_ENV} 환경에서는 COOKIE_SECURE=true가 필요합니다.`,
    });
  }

  // 3. trust proxy: 무한 신뢰(true) 금지. 프록시 홉 수(정수)나 IP를 지정.
  if (env.TRUST_PROXY === true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TRUST_PROXY'],
      message: 'prod/stage에서 TRUST_PROXY=true(무한 신뢰)는 금지입니다. 프록시 홉 수(정수)나 신뢰할 IP를 지정하세요.',
    });
  }

  // Swagger 노출은 운영 정책 선택이지 안전성 정답이 없으므로 게이트에서 강제하지 않는다.
  // (내부망 전용으로 prod에 열어두는 케이스가 있다.) 노출 여부는 SWAGGER_ENABLED로 운영자가 결정.
});

export type Env = z.infer<typeof envSchema>;

/**
 * @nestjs/config `validate` 훅. 부팅 시 process.env를 parse·강제 변환한다.
 * 실패 시 모든 이슈를 모아 에러를 던져 앱 시작을 막는다.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경 변수 검증 실패:\n${issues}`);
  }

  return result.data;
}
