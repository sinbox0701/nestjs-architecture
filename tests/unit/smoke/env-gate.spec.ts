import { validateEnv } from '@/config/env.schema';

describe('env safety gate (superRefine)', () => {
  it('dev: 약한 설정이어도 통과', () => {
    expect(() => validateEnv({ APP_ENV: 'dev' })).not.toThrow();
  });

  it('prod: 기본 시크릿/COOKIE_SECURE=false → 거부', () => {
    expect(() => validateEnv({ APP_ENV: 'prod', NODE_ENV: 'production' })).toThrow(/JWT_SECRET|COOKIE_SECURE/);
  });

  /** prod에서 통과하는 완전 강화 설정(개별 규칙 테스트의 베이스). */
  const hardenedProd = () => ({
    APP_ENV: 'prod',
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(40),
    REFRESH_TOKEN_SECRET: 'c'.repeat(40),
    SESSION_SECRET: 'b'.repeat(40),
    COOKIE_SECURE: 'true',
    SWAGGER_ENABLED: 'false',
    TRUST_PROXY: '1',
  });

  it('prod: 모두 강화하면 통과', () => {
    expect(() => validateEnv(hardenedProd())).not.toThrow();
  });

  it('prod: REFRESH_TOKEN_SECRET 기본/약한값 → 거부', () => {
    expect(() => validateEnv({ ...hardenedProd(), REFRESH_TOKEN_SECRET: 'change-me-in-production' })).toThrow(
      /REFRESH_TOKEN_SECRET/,
    );
  });

  it('prod: JWT_SECRET === REFRESH_TOKEN_SECRET(시크릿 미분리) → 거부', () => {
    expect(() => validateEnv({ ...hardenedProd(), REFRESH_TOKEN_SECRET: 'a'.repeat(40) })).toThrow(
      /REFRESH_TOKEN_SECRET/,
    );
  });

  it('prod: RESPONSE_DEBUG_DETAIL=true → 거부', () => {
    expect(() => validateEnv({ ...hardenedProd(), RESPONSE_DEBUG_DETAIL: 'true' })).toThrow(/RESPONSE_DEBUG_DETAIL/);
  });

  it('prod: TRUST_PROXY=true(무한신뢰) → 거부', () => {
    expect(() => validateEnv({ ...hardenedProd(), TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
  });

  it('환경 무관: COOKIE_SAME_SITE=none + COOKIE_SECURE=false → 거부', () => {
    expect(() => validateEnv({ APP_ENV: 'dev', COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
  });
});
