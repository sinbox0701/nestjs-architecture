/**
 * Tier0 인증 공용 상수. blocklist 키 prefix는 AuthGuard(검증측)와 도메인 auth(등록측)가 공유한다.
 * core가 단일 출처이며, 도메인 모듈은 여기서 import한다(core→modules 역참조 금지).
 */
export const BLOCKLIST_PREFIX = 'blocked:';
