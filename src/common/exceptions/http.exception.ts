import { HttpException as NestHttpException } from '@nestjs/common';

export class HttpException extends NestHttpException {
  private exceptionCode: string;
  private debugDetail?: object;

  constructor(code: string, message: string, httpCode: number) {
    super({ success: false, error: { code, message } }, httpCode);
    this.message = message;
    this.exceptionCode = code;
  }

  getCode(): string {
    return this.exceptionCode;
  }

  setDebugDetail(debugDetail: object): void {
    this.debugDetail = debugDetail;
  }

  getResponse(): string | object {
    const response = super.getResponse();
    if (typeof response === 'string') return response;
    if (this.debugDetail) return { ...response, debugDetail: this.debugDetail };
    return response;
  }
}
