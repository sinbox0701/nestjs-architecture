import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import { IdentityEvent } from '../event/identity-event.constant';
import { UserCreatedEvent } from '../event/user-created.event';

/**
 * UserCreated 후속 처리 핸들러 — "비동기 연결(이벤트)" 경로의 레퍼런스 구현.
 *
 * 핵심 write(사용자 생성)는 UserService에서 끝나고, 알림/프로비저닝 같은 후속 작업만 여기로 분리한다.
 * 참조: docs/convention/02-module-rules.md
 *
 * 두 가지 필수 패턴:
 * 1. `{ async: true }` — 발행자의 요청/트랜잭션과 분리 실행. 후속 작업 실패가 원본 write를 롤백하지 않는다.
 * 2. `RequestContext.create(em, ...)` — 비동기 핸들러는 요청 EM 컨텍스트 밖이다. 새 EM fork를 열어야
 *    핸들러 내부에서 안전하게 DB 작업을 할 수 있다(이게 없으면 ValidationError/글로벌 컨텍스트 경고).
 */
@Injectable()
export class UserCreatedHandler {
  private readonly logger = new FrameworkLogger(UserCreatedHandler.name);

  constructor(private readonly orm: MikroORM) {}

  @OnEvent(IdentityEvent.USER_CREATED, { async: true })
  async handle(event: UserCreatedEvent): Promise<void> {
    await RequestContext.create(this.orm.em, async () => {
      try {
        // 예시 후속 작업: 환영 메일 발송, 기본 설정 프로비저닝, 외부 시스템 동기화 등.
        // 실패는 여기서 흡수해 원본 write를 보호한다(로그로 추적).
        this.logger.log(`UserCreated 후속처리: userId=${event.userId} email=${event.email} teamId=${event.teamId}`);
      } catch (error) {
        this.logger.error(
          `UserCreated 후속처리 실패: userId=${event.userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });
  }
}
