import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';
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
