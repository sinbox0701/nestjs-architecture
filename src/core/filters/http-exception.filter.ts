import { ArgumentsHost, Catch, ExceptionFilter, HttpException as NestHttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Response } from 'express';

import { HttpException } from '@/common/exceptions';
import { LogSanitizer } from '@/common/utils/log-sanitizer';

import { FrameworkLogger } from '../logger/framework-logger';

@Catch(NestHttpException, Error)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new FrameworkLogger(HttpExceptionFilter.name);
  private readonly configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  catch(e: Error | NestHttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (response.headersSent) {
      this.logger.warn(
        `Headers already sent, cannot send error response: ${request.method} ${request.url} - ${e.message}`,
      );
      return;
    }

    const isDebugDetailEnabled = this.configService.get<boolean>('RESPONSE_DEBUG_DETAIL');

    const status = e instanceof NestHttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = e instanceof NestHttpException ? e.message : 'Internal server error';

    const error = {
      status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      body: request.body,
      stack: e.stack,
      detail: e.message,
    };

    this.logger.error(`${request.method} ${request.url}: ${status} ${message}\n${e.stack}`);

    if (e instanceof HttpException) {
      // Wrapped HttpException
      if (isDebugDetailEnabled) e.setDebugDetail(error);
      response.status(status).json(LogSanitizer.sanitize(e.getResponse()));
    } else if (e instanceof NestHttpException) {
      // NestJs HttpException
      if (isDebugDetailEnabled) {
        const errorResponse = new HttpException('NEST_HTTP_EXCEPTION', message, status);
        errorResponse.setDebugDetail(error);
        response.status(status).json(LogSanitizer.sanitize(errorResponse.getResponse()));
      } else {
        response.status(status).json(LogSanitizer.sanitize(e.getResponse()));
      }
    } else {
      // Unhandled Error
      const errorResponse = new HttpException('500', message, status);
      if (isDebugDetailEnabled) errorResponse.setDebugDetail(error);
      response.status(status).json(LogSanitizer.sanitize(errorResponse.getResponse()));
    }
  }
}
