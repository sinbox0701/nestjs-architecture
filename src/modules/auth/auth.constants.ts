/** 인증 쿠키/blocklist 키 상수. */
export const AUTH_COOKIE = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
} as const;

/** 강제 로그아웃 blocklist 키 prefix (AuthGuard와 공유). */
export const BLOCKLIST_PREFIX = 'blocked:';

/** Refresh Token 저장소 Redis 키 prefix. `rt:{userId}:{family}` → 현재 유효한 RT jti. */
export const REFRESH_STORE_PREFIX = 'rt:';
