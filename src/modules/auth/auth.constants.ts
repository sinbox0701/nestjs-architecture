/** 강제 로그아웃 blocklist 키 prefix. 단일 출처는 core/auth — 등록측(도메인)이 재export해 공유. */
export { BLOCKLIST_PREFIX } from '@/core/auth/auth.constants';

/** 인증 쿠키 키 상수. */
export const AUTH_COOKIE = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
} as const;

/** Refresh Token 저장소 Redis 키 prefix. `rt:{userId}:{family}` → 현재 유효한 RT jti. */
export const REFRESH_STORE_PREFIX = 'rt:';
