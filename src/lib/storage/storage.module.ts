import { Global, Module } from '@nestjs/common';

import { NoopStorageDriver } from './noop-storage.driver';
import { STORAGE_DRIVER } from './storage.types';

/**
 * Storage Module
 *
 * 파일 스토리지 인터페이스를 DI로 제공하는 글로벌 모듈.
 * 기본 구현은 NoopStorageDriver (put/delete 시 예외 발생).
 *
 * 도메인 페이즈에서 실제 S3 driver 연결 시:
 * - storageConfig.driver === 's3' 플래그로 게이팅
 * - 이 모듈의 providers 배열에서 STORAGE_DRIVER 바인딩을 교체
 */
@Global()
@Module({
  providers: [
    NoopStorageDriver,
    {
      provide: STORAGE_DRIVER,
      useClass: NoopStorageDriver,
    },
  ],
  exports: [STORAGE_DRIVER],
})
export class StorageModule {}
