import { Logger } from '@nestjs/common';
import { DefaultLogger, LogContext, LoggerNamespace } from '@mikro-orm/postgresql';

export class OrmLogger extends DefaultLogger {
  log(namespace: LoggerNamespace, message: string, context?: LogContext): void {
    switch (context?.level) {
      case 'info':
        Logger.verbose(message, namespace);
        return;
      case 'warning':
        Logger.warn(message, context.error, namespace);
        return;
      case 'error':
        Logger.error(message, namespace);
        return;
      default:
        break;
    }
    Logger.log(message, namespace);
  }
}
