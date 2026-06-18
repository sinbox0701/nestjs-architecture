import { Module } from '@nestjs/common';

/**
 * Session Module — placeholder
 *
 * 실제 세션/passport 연결은 도메인 auth 페이즈에서 수행합니다.
 * 여기서는 AppModule에서 선택적으로 import할 수 있도록 컴파일 가능한
 * 빈 모듈만 제공합니다.
 *
 * 도메인 페이즈에서 Redis 기반 세션 스토어(connect-redis 등)나
 * passport 전략을 이 모듈에 추가하십시오.
 */
@Module({})
export class SessionModule {}
