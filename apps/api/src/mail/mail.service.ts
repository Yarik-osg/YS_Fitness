import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.service.js';
import { buildWelcomeEmail, type MailLocale } from './welcome-email.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(config: AppConfigService) {
    const host = config.get('SMTP_HOST');
    const user = config.get('SMTP_USER');
    const password = config.get('SMTP_PASSWORD');

    this.from = config.get('MAIL_FROM');
    this.appUrl = (
      config.get('APP_URL') ??
      config.get('WEB_ORIGINS').split(',')[0]?.trim() ??
      'http://localhost:3000'
    ).replace(/\/+$/, '');
    this.transport = host
      ? createTransport({
          host,
          port: config.get('SMTP_PORT'),
          secure: config.get('SMTP_SECURE'),
          ...(user && password ? { auth: { user, pass: password } } : {}),
        })
      : null;

    if (!this.transport) {
      this.logger.warn('SMTP_HOST is not set; outgoing email is disabled');
    }
  }

  /**
   * Sends the account-created notice. Never throws: a mail outage must not
   * affect registration, so failures are only logged.
   */
  async sendWelcome(to: string, locale: MailLocale = 'uk'): Promise<void> {
    if (!this.transport) return;

    const { subject, text } = buildWelcomeEmail({
      locale,
      email: to,
      loginUrl: `${this.appUrl}/${locale}/login`,
    });

    try {
      await this.transport.sendMail({ from: this.from, to, subject, text });
    } catch (error) {
      this.logger.warn(
        `Welcome email failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
