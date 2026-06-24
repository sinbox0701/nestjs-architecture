import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

import { getTraceContext } from '@/tracing';

export class ContextStorage {
  public static readonly FRAMEWORK_SIGNATURE_KEY = 'x-trace-id';
  public static readonly FRAMEWORK_NAME_KEY = 'x-framework-name';
  protected static readonly contextStorage = new AsyncLocalStorage<Map<string, any>>();

  public static getContextStorage(): AsyncLocalStorage<Map<string, any>> {
    return this.contextStorage;
  }

  /**
   * Return the current trace signature. Prefers the active OTel trace_id so
   * logs and the `x-trace-id` response header are aligned with the trace
   * visible in Tempo. Falls back to the custom ALS-backed value when OTel is
   * disabled or there is no active span.
   */
  public static getCurrentContextSign(): string {
    const otel = getTraceContext();
    if (otel?.traceId) return otel.traceId;
    return this.contextStorage.getStore()?.get(ContextStorage.FRAMEWORK_SIGNATURE_KEY) ?? 'NONE';
  }

  public static getCurrentContextCaller(): string {
    return this.contextStorage.getStore()?.get(ContextStorage.FRAMEWORK_NAME_KEY) ?? null;
  }

  public static generateContext(signature?: string): Map<string, any> {
    const context = new Map<string, any>();

    // Prefer OTel traceId so the ALS-stored signature matches the active span.
    const otel = getTraceContext();
    let contextValue = signature || otel?.traceId;
    if (!contextValue) {
      const current = new Date();
      contextValue =
        `${current.getFullYear()}` +
        `${String(current.getMonth() + 1).padStart(2, '0')}` +
        `${String(current.getDate()).padStart(2, '0')}` +
        `${String(current.getHours()).padStart(2, '0')}` +
        `${String(current.getMinutes()).padStart(2, '0')}` +
        `${String(current.getSeconds()).padStart(2, '0')}` +
        `-${String(current.getMilliseconds()).padStart(3, '0')}` +
        `${randomBytes(6).toString('hex')}`;
    }

    context.set(ContextStorage.FRAMEWORK_SIGNATURE_KEY, contextValue);

    return context;
  }
}
