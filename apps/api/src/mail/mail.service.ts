import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.service.js';
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
} from './password-emails.js';
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
    await this.send(
      to,
      buildWelcomeEmail({
        locale,
        email: to,
        loginUrl: `${this.appUrl}/${locale}/login`,
      }),
      'Welcome email',
    );
  }

  /** Sends the reset link. Never throws, so the caller's answer cannot reveal delivery. */
  async sendPasswordReset(
    to: string,
    token: string,
    locale: MailLocale = 'uk',
  ): Promise<void> {
    await this.send(
      to,
      buildPasswordResetEmail({
        locale,
        resetUrl: `${this.appUrl}/${locale}/reset-password?token=${encodeURIComponent(token)}`,
      }),
      'Password reset email',
    );
  }

  /** Tells the owner their password changed. Never throws. */
  async sendPasswordChanged(
    to: string,
    locale: MailLocale = 'uk',
  ): Promise<void> {
    await this.send(
      to,
      buildPasswordChangedEmail({
        locale,
        email: to,
        forgotUrl: `${this.appUrl}/${locale}/forgot-password`,
      }),
      'Password changed email',
    );
  }

  private async send(
    to: string,
    { subject, text }: { subject: string; text: string },
    label: string,
  ): Promise<void> {
    if (!this.transport) return;

    try {
      await this.transport.sendMail({ from: this.from, to, subject, text });
    } catch (error) {
      this.logger.warn(
        `${label} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
