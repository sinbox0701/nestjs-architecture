/**
 * 사용자 생성 이벤트 페이로드.
 *
 * 핸들러가 다시 조회하지 않아도 되도록 후속 처리에 필요한 최소 식별자만 담는다(엔티티 참조 금지 —
 * 핸들러는 별도 EM 컨텍스트에서 돈다). 참조: docs/convention/02-module-rules.md (비동기 연결)
 */
export class UserCreatedEvent {
  constructor(
    public readonly userId: number,
    public readonly email: string,
    public readonly teamId: number,
  ) {}
}
