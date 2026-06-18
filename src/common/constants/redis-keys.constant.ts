/**
 * Redis Keys
 *
 * Redis 키 패턴을 중앙에서 관리
 * - 타입 안정성 보장
 * - 일관된 키 네이밍 규칙 적용
 * - 유지보수성 향상
 */

/**
 * Redis 키 패턴
 *
 * 모든 Redis 키는 이 객체의 함수를 통해 생성
 */
export const RedisKeys = {
  /**
   * 로그인 Rate Limit 키
   * - 용도: IP 기반 로그인 시도 제한
   * - TTL: 5분
   */
  rateLimitLogin: (ip: string) => `rate-limit:login:${ip}`,
} as const;

/**
 * Redis TTL 상수 (초 단위)
 *
 * 설정 파일에 정의되지 않은 정적 TTL 값만 관리
 */
export const RedisTTL = {
  /** Rate Limit TTL: 5분 */
  RATE_LIMIT: 5 * 60,
} as const;
