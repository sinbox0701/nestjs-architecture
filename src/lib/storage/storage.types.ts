export interface StorageDriver {
  putObject(key: string, body: Buffer | string, contentType?: string): Promise<void>;
  getSignedUrl(key: string, expiresInSec?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
