import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
} from './password-emails.js';
import { buildWelcomeEmail } from './welcome-email.js';

const mailer = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  createTransport: mailer.createTransport.mockImplementation(() => ({
    sendMail: mailer.sendMail,
  })),
}));

function createService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    MAIL_FROM: 'YS Fitness <no-reply@localhost>',
    WEB_ORIGINS: 'http://localhost:3000,https://example.ngrok-free.dev',
    ...overrides,
  };
  return new MailService({ get: (key: string) => values[key] } as never);
}

describe('MailService.sendWelcome', () => {
  beforeEach(() => {
    mailer.sendMail.mockReset().mockResolvedValue(undefined);
    mailer.createTransport.mockClear();
  });

  it('sends a Ukrainian text email with a locale login link by default', async () => {
    await createService().sendWelcome('olena@example.com');

    expect(mailer.sendMail).toHaveBeenCalledWith({
      from: 'YS Fitness <no-reply@localhost>',
      to: 'olena@example.com',
      subject: 'Акаунт YS Fitness створено',
      text: expect.stringContaining('http://localhost:3000/uk/login'),
    });
    expect(mailer.sendMail.mock.calls[0]![0]).not.toHaveProperty('html');
  });

  it('sends the English email with the English login link', async () => {
    await createService().sendWelcome('olena@example.com', 'en');

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your YS Fitness account is created',
        text: expect.stringContaining('http://localhost:3000/en/login'),
      }),
    );
  });

  it('prefers APP_URL and trims its trailing slash', async () => {
    await createService({ APP_URL: 'https://app.example.com/' }).sendWelcome(
      'olena@example.com',
      'en',
    );

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('https://app.example.com/en/login'),
      }),
    );
  });

  it('passes SMTP credentials only when both are set', () => {
    createService({ SMTP_USER: 'user', SMTP_PASSWORD: 'secret' });
    expect(mailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ auth: { user: 'user', pass: 'secret' } }),
    );

    createService({ SMTP_USER: 'user' });
    expect(mailer.createTransport.mock.lastCall![0]).not.toHaveProperty('auth');
  });

  it('sends nothing when SMTP_HOST is not set', async () => {
    mailer.createTransport.mockClear();

    await createService({ SMTP_HOST: undefined }).sendWelcome('a@example.com');

    expect(mailer.createTransport).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('swallows a delivery failure so registration is unaffected', async () => {
    mailer.sendMail.mockRejectedValue(new Error('connection refused'));

    await expect(
      createService().sendWelcome('olena@example.com'),
    ).resolves.toBeUndefined();
  });
});

describe('buildWelcomeEmail', () => {
  it('names the account email and the login link in both languages', () => {
    for (const locale of ['uk', 'en'] as const) {
      const { subject, text } = buildWelcomeEmail({
        locale,
        email: 'olena@example.com',
        loginUrl: `http://localhost:3000/${locale}/login`,
      });

      expect(subject.length).toBeGreaterThan(0);
      expect(text).toContain('olena@example.com');
      expect(text).toContain(`http://localhost:3000/${locale}/login`);
    }
  });
});

describe('MailService password emails', () => {
  beforeEach(() => {
    mailer.sendMail.mockReset().mockResolvedValue(undefined);
  });

  it('mails an encoded reset link in the chosen language', async () => {
    await createService().sendPasswordReset(
      'olena@example.com',
      'a+b/c=',
      'en',
    );

    expect(mailer.sendMail).toHaveBeenCalledWith({
      from: 'YS Fitness <no-reply@localhost>',
      to: 'olena@example.com',
      subject: 'Reset your YS Fitness password',
      text: expect.stringContaining(
        'http://localhost:3000/en/reset-password?token=a%2Bb%2Fc%3D',
      ),
    });
  });

  it('defaults the reset email to Ukrainian', async () => {
    await createService().sendPasswordReset('olena@example.com', 'token');

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Скидання пароля YS Fitness',
        text: expect.stringContaining(
          'http://localhost:3000/uk/reset-password',
        ),
      }),
    );
  });

  it('notifies about a changed password with a link to reset it again', async () => {
    await createService().sendPasswordChanged('olena@example.com', 'en');

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'olena@example.com',
        subject: 'Your YS Fitness password was changed',
        text: expect.stringContaining(
          'http://localhost:3000/en/forgot-password',
        ),
      }),
    );
  });

  it('never throws and sends nothing without SMTP', async () => {
    await expect(
      createService({ SMTP_HOST: undefined }).sendPasswordReset('a@b.co', 't'),
    ).resolves.toBeUndefined();
    expect(mailer.sendMail).not.toHaveBeenCalled();

    mailer.sendMail.mockRejectedValue(new Error('down'));
    await expect(
      createService().sendPasswordChanged('a@b.co'),
    ).resolves.toBeUndefined();
  });
});

describe('password email builders', () => {
  it('state the link and the 30 minute limit in both languages', () => {
    for (const locale of ['uk', 'en'] as const) {
      const reset = buildPasswordResetEmail({
        locale,
        resetUrl: `https://x.test/${locale}/reset-password?token=t`,
      });
      expect(reset.text).toContain(
        `https://x.test/${locale}/reset-password?token=t`,
      );
      expect(reset.text).toContain('30');

      const changed = buildPasswordChangedEmail({
        locale,
        email: 'olena@example.com',
        forgotUrl: `https://x.test/${locale}/forgot-password`,
      });
      expect(changed.text).toContain('olena@example.com');
      expect(changed.text).toContain(
        `https://x.test/${locale}/forgot-password`,
      );
    }
  });
});
