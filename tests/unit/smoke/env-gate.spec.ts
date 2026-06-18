import { validateEnv } from '@/config/env.schema';

describe('env safety gate (superRefine)', () => {
  it('dev: 약한 설정이어도 통과', () => {
    expect(() => validateEnv({ APP_ENV: 'dev' })).not.toThrow();
  });

  it('prod: 기본 시크릿/COOKIE_SECURE=false → 거부', () => {
    expect(() => validateEnv({ APP_ENV: 'prod', NODE_ENV: 'production' })).toThrow(/JWT_SECRET|COOKIE_SECURE/);
  });

  it('prod: 모두 강화하면 통과', () => {
    expect(() =>
      validateEnv({
        APP_ENV: 'prod',
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(40),
        SESSION_SECRET: 'b'.repeat(40),
        COOKIE_SECURE: 'true',
        SWAGGER_ENABLED: 'false',
        TRUST_PROXY: '1',
      }),
    ).not.toThrow();
  });

  it('prod: TRUST_PROXY=true(무한신뢰) → 거부', () => {
    expect(() =>
      validateEnv({
        APP_ENV: 'prod',
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(40),
        SESSION_SECRET: 'b'.repeat(40),
        COOKIE_SECURE: 'true',
        SWAGGER_ENABLED: 'false',
        TRUST_PROXY: 'true',
      }),
    ).toThrow(/TRUST_PROXY/);
  });
});
