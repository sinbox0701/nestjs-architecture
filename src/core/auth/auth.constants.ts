/**
 * Tier0 인증 공용 상수. blocklist 키 prefix는 AuthGuard(검증측)와 도메인 auth(등록측)가 공유한다.
 * core가 단일 출처이며, 도메인 모듈은 여기서 import한다(core→modules 역참조 금지).
 */
export const BLOCKLIST_PREFIX = 'blocked:';

/**
 * 세션 epoch 키 prefix. `session:epoch:{userId}` → 현재 epoch(정수).
 * AT에 실린 epoch보다 저장된 epoch가 크면 그 사용자의 기존 토큰을 전부 무효로 본다(사용자 단위 무효화).
 * 검증측(AuthGuard)과 발급/증가측(auth 모듈)이 공유하므로 core가 단일 출처다.
 */
export const SESSION_EPOCH_PREFIX = 'session:epoch:';
