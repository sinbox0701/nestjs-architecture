import { Global, Module } from '@nestjs/common';

import { ConsoleMailSender } from './console-mail.sender';
import { MAIL_SENDER } from './mail.types';

/**
 * Mail Module
 *
 * 메일 전송 인터페이스를 DI로 제공하는 글로벌 모듈.
 * 기본 구현은 ConsoleMailSender (로그 출력 전용).
 *
 * 도메인 페이즈에서 실제 provider(SMTP/SES)로 교체 시:
 * - mailConfig.enabled 등 config 플래그로 게이팅
 * - 이 모듈의 providers 배열에서 MAIL_SENDER 바인딩을 교체
 */
@Global()
@Module({
  providers: [
    ConsoleMailSender,
    {
      provide: MAIL_SENDER,
      useClass: ConsoleMailSender,
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
