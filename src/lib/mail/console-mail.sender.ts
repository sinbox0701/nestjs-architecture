import { Injectable } from '@nestjs/common';

import { FrameworkLogger } from '@/core/logger/framework-logger';

import { MailSender, SendMailInput } from './mail.types';

@Injectable()
export class ConsoleMailSender implements MailSender {
  private readonly logger = new FrameworkLogger(ConsoleMailSender.name);

  async send(input: SendMailInput): Promise<void> {
    this.logger.log(
      `[Mail] to=${input.to} subject="${input.subject}" text=${input.text ?? ''} html=${input.html ?? ''}`,
    );
  }
}
