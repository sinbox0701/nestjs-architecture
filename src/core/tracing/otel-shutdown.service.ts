import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';

import { sdk } from '@/tracing';

const SHUTDOWN_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${SHUTDOWN_TIMEOUT_MS}ms`)), SHUTDOWN_TIMEOUT_MS),
    ),
  ]);
}

/**
 * Flush and shut down OTel providers when NestJS is shutting down. Wired via
 * `BeforeApplicationShutdown` (not `process.on('SIGTERM')`) so it fires
 * BEFORE the HTTP server stops accepting connections, which is the last
 * moment in-flight request spans can still be exported.
 *
 * The starter exports traces only (NodeSDK). If a logs/metrics bridge is
 * added later, flush its provider here as well.
 *
 * Requires `app.enableShutdownHooks()` in bootstrap (already called).
 */
@Injectable()
export class OtelShutdownService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(OtelShutdownService.name);

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    if (!sdk) {
      return;
    }
    this.logger.log(`OTel shutdown initiated (signal=${signal ?? 'unknown'})`);

    try {
      await withTimeout(sdk.shutdown(), 'NodeSDK shutdown');
    } catch (err) {
      this.logger.error('NodeSDK shutdown failed', err instanceof Error ? err.stack : String(err));
    }

    this.logger.log('OTel shutdown complete');
  }
}
