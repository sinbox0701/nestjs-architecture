import { Injectable } from '@nestjs/common';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import { StorageDriver } from './storage.types';

@Injectable()
export class NoopStorageDriver implements StorageDriver {
  private readonly logger = new FrameworkLogger(NoopStorageDriver.name);

  async putObject(key: string, _body: Buffer | string, _contentType?: string): Promise<void> {
    this.logger.warn(`NoopStorageDriver: putObject called for key="${key}" — no storage driver configured.`);
    throw new Error('Storage driver not configured (STORAGE_DRIVER=noop). Configure an S3 driver in the domain phase.');
  }

  async getSignedUrl(key: string, _expiresInSec?: number): Promise<string> {
    this.logger.warn(`NoopStorageDriver: getSignedUrl called for key="${key}" — returning placeholder URL.`);
    return `http://localhost/noop-storage/${encodeURIComponent(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.logger.warn(`NoopStorageDriver: deleteObject called for key="${key}" — no storage driver configured.`);
    throw new Error('Storage driver not configured (STORAGE_DRIVER=noop). Configure an S3 driver in the domain phase.');
  }
}
