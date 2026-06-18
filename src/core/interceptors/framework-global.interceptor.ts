import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Observable } from 'rxjs';

import { LogSanitizer } from '@/common/utils/log-sanitizer';
import { ContextStorage } from '@/core/logger/context-storage';
import { FrameworkLogger } from '@/core/logger/framework-logger';

@Injectable()
export class FrameworkGlobalInterceptor implements NestInterceptor {
  private readonly appName: string;

  constructor(private readonly configService: ConfigService) {
    this.appName = this.configService.get<string>('APP_NAME', 'backend-template');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === 'http') {
      return this.httpIntercept(context, next);
    }
    return next.handle();
  }

  private httpIntercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.headers.accept === 'text/event-stream') {
      return next.handle();
    }
    const serverName = request[ContextStorage.FRAMEWORK_NAME_KEY] || null;
    let signature = request[ContextStorage.FRAMEWORK_SIGNATURE_KEY] || null;

    const generatedContext = ContextStorage.generateContext(signature);
    signature = generatedContext.get(ContextStorage.FRAMEWORK_SIGNATURE_KEY);
    generatedContext.set(ContextStorage.FRAMEWORK_NAME_KEY, serverName);
    if (!request[ContextStorage.FRAMEWORK_SIGNATURE_KEY]) request[ContextStorage.FRAMEWORK_SIGNATURE_KEY] = signature;

    return ContextStorage.getContextStorage().run(generatedContext, () => {
      const logger = new FrameworkLogger('HTTP');
      const { method, originalUrl, query, body, headers } = request;
      headers['ip'] = headers['x-forwarded-for'] || headers['x-real-ip'] || request.ip || '';

      if (serverName) logger.debug(`[FROM] ${serverName}`);
      logger.debug(`[${method}] ${originalUrl}${query ? `?${new URLSearchParams(query).toString()}` : ''}`);
      if (body) logger.debug(`[BODY] ${JSON.stringify(LogSanitizer.sanitize(body))}`);

      context.switchToHttp().getResponse()?.setHeader(ContextStorage.FRAMEWORK_SIGNATURE_KEY, signature);
      context.switchToHttp().getResponse()?.setHeader(ContextStorage.FRAMEWORK_NAME_KEY, this.appName);

      return next.handle();
    });
  }
}
