import { ConsoleLogger, ConsoleLoggerOptions, LogLevel } from '@nestjs/common';

import { ContextStorage } from './context-storage';

export class FrameworkLogger extends ConsoleLogger {
  protected static readonly LOG_LEVEL_VALUES: Record<LogLevel, number> = {
    debug: 0,
    verbose: 1,
    log: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  /**
   * env LOG_LEVEL(debug|info|warn|error, env.schema 기준)을 NestJS LogLevel로 매핑.
   * NestJS에는 'info'가 없으므로 'log'로 대응시킨다(미매핑 시 debug로 떨어지는 버그 방지).
   */
  protected static readonly ENV_LOG_LEVEL_MAP: Record<string, LogLevel> = {
    debug: 'debug',
    info: 'log',
    warn: 'warn',
    error: 'error',
  };

  protected readonly logLevels: LogLevel[] = [];

  constructor(context?: string, options?: ConsoleLoggerOptions, prefix?: string) {
    options = options || {};
    options.prefix = prefix || process.env.APP_NAME || 'backend-template';
    super(context || '', options);

    const logLevel = FrameworkLogger.ENV_LOG_LEVEL_MAP[process.env.LOG_LEVEL ?? 'debug'] ?? 'debug';
    const currentLogLevelValue = FrameworkLogger.LOG_LEVEL_VALUES[logLevel];
    this.logLevels = (Object.keys(FrameworkLogger.LOG_LEVEL_VALUES) as LogLevel[]).filter(
      (level) => FrameworkLogger.LOG_LEVEL_VALUES[level] >= currentLogLevelValue,
    );

    super.setLogLevels(this.logLevels);
  }

  /**
   * Extract `functionName:lineNumber` from the call-site stack trace.
   *
   * `Error.captureStackTrace(err, fn)` omits all frames at/above `fn`, so
   * passing `this[logLevel]` makes the first captured frame the immediate
   * caller of `logger.log(...)` etc.
   */
  private getCallerInfo(logLevel: LogLevel): string {
    try {
      const tmpError = new Error();
      const omitFn = (this as unknown as Record<string, unknown>)[logLevel];
      if (typeof omitFn === 'function') {
        Error.captureStackTrace(tmpError, omitFn as (...args: unknown[]) => unknown);
      }
      const stackLines = tmpError.stack?.split('\n') || [];
      if (stackLines.length > 1) {
        const targetLine = stackLines[1].trim();
        const match = targetLine.match(/at (\S+)\.(\S+) \(([^:]+):(\d+):(\d+)\)/);
        if (match) {
          const functionName = match[2] || 'NONE';
          const lineNumber = match[4] || 'NONE';
          return `${functionName}:${lineNumber}`;
        }
      }
    } catch {
      // fall through
    }
    return 'NONE:NONE';
  }

  /**
   * stdout formatter: prepend `[caller][sign] message` to the standard NestJS
   * colored output. `sign` prefers OTel traceId when an active span exists,
   * otherwise the ALS-based x-trace-id.
   */
  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    const caller = this.getCallerInfo(logLevel);
    const sign = ContextStorage.getCurrnetContextSign();
    return super.formatMessage(
      logLevel,
      `[${caller}][${sign}] ${message}`,
      pidMessage,
      formattedLogLevel,
      contextMessage,
      timestampDiff,
    );
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message, ...optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message, ...optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(message, ...optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(message, ...optionalParams);
  }

  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(message, ...optionalParams);
  }
}
