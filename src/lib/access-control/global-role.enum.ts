/**
 * 플랫폼 전역 역할. 팀 스코프 역할(`AuthSubject.teams[].role`)과 별개로, 팀 소속과 무관하게
 * 작동하는 운영자 권한이다.
 *
 * `SUPER`는 IAM root처럼 모든 인가를 bypass한다(PolicyGuard / ResourcePolicy에서 즉시 통과).
 * 운영 역할이 더 필요하면 도메인 단계에서 이 enum을 확장한다.
 */
export enum GlobalRole {
  SUPER = 'SUPER',
}
