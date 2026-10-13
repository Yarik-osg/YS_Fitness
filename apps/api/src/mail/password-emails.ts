import type { MailLocale } from './welcome-email.js';

export const PASSWORD_RESET_TTL_MINUTES = 30;

export interface PasswordEmail {
  subject: string;
  text: string;
}

export function buildPasswordResetEmail(input: {
  locale: MailLocale;
  resetUrl: string;
}): PasswordEmail {
  if (input.locale === 'en') {
    return {
      subject: 'Reset your YS Fitness password',
      text: [
        'We received a request to reset your YS Fitness password.',
        '',
        `Choose a new password here (the link works once and expires in ${PASSWORD_RESET_TTL_MINUTES} minutes):`,
        input.resetUrl,
        '',
        'If you did not ask for this, ignore this email. Your password stays the same.',
      ].join('\n'),
    };
  }

  return {
    subject: 'Скидання пароля YS Fitness',
    text: [
      'Ми отримали запит на скидання пароля до YS Fitness.',
      '',
      `Обрати новий пароль можна тут (посилання одноразове й діє ${PASSWORD_RESET_TTL_MINUTES} хвилин):`,
      input.resetUrl,
      '',
      'Якщо ви не робили цього запиту, просто проігноруйте лист. Пароль не зміниться.',
    ].join('\n'),
  };
}

export function buildPasswordChangedEmail(input: {
  locale: MailLocale;
  email: string;
  forgotUrl: string;
}): PasswordEmail {
  if (input.locale === 'en') {
    return {
      subject: 'Your YS Fitness password was changed',
      text: [
        `The password for ${input.email} was just changed, and you were signed out on all devices.`,
        '',
        'If this was you, no action is needed.',
        'If it was not, reset your password right away:',
        input.forgotUrl,
      ].join('\n'),
    };
  }

  return {
    subject: 'Пароль YS Fitness змінено',
    text: [
      `Пароль для ${input.email} щойно змінено, а на всіх пристроях вас розлогінено.`,
      '',
      'Якщо це були ви, нічого робити не потрібно.',
      'Якщо ні, негайно скиньте пароль:',
      input.forgotUrl,
    ].join('\n'),
  };
}
