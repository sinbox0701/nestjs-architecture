import { HttpStatus } from '@nestjs/common';

import { HttpException } from '@/common/exceptions/http.exception';

export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super('400', message, HttpStatus.BAD_REQUEST);
  }
}

export class BadPageRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super('400_PAGE', message, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super('401', message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super('403', message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super('404', message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictException extends HttpException {
  constructor(message = 'Conflict') {
    super('409', message, HttpStatus.CONFLICT);
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message = 'Internal Server Error') {
    super('500', message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class IOException extends HttpException {
  constructor(message = 'IO Exception') {
    super('500_IO', message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
