import { Logger } from '@nestjs/common';
import { DefaultLogger, LogContext, LoggerNamespace } from '@mikro-orm/postgresql';

export class OrmLogger extends DefaultLogger {
  log(namespace: LoggerNamespace, message: string, context?: LogContext): void {
    switch (context?.level) {
      case 'info':
        Logger.verbose(message, namespace);
        return;
      case 'warning': {
        // NestJS Logger.warn(message, ...optionalParams)는 마지막 string을 context로 취급한다.
        // namespace를 context로 유지하기 위해 error는 메시지에 합쳐서 넘긴다.
        const detail = context.error?.message;
        Logger.warn(detail ? `${message} ${detail}` : message, namespace);
        return;
      }
      case 'error':
        Logger.error(message, namespace);
        return;
      default:
        break;
    }
    Logger.log(message, namespace);
  }
}
