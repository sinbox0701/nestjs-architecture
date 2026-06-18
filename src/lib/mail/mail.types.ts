export interface SendMailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface MailSender {
  send(input: SendMailInput): Promise<void>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');
