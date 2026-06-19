/**
 * identity 도메인이 발행하는 이벤트 이름 상수.
 *
 * 문자열 오타로 인한 "조용한 미수신"을 막기 위해 상수로 고정한다(매직 스트링 금지).
 * 네임스페이스 컨벤션: `<도메인>.<엔티티>.<과거형 동작>`.
 */
export const IdentityEvent = {
  USER_CREATED: 'identity.user.created',
} as const;
