export type MailLocale = 'uk' | 'en';

export interface WelcomeEmail {
  subject: string;
  text: string;
}

export function buildWelcomeEmail(input: {
  locale: MailLocale;
  email: string;
  loginUrl: string;
}): WelcomeEmail {
  if (input.locale === 'en') {
    return {
      subject: 'Your YS Fitness account is created',
      text: [
        'Welcome to YS Fitness!',
        '',
        `An account for ${input.email} has been created. You can log in here:`,
        input.loginUrl,
        '',
        'If you did not create this account, you can ignore this email.',
      ].join('\n'),
    };
  }

  return {
    subject: 'Акаунт YS Fitness створено',
    text: [
      'Вітаємо в YS Fitness!',
      '',
      `Акаунт для ${input.email} створено. Увійти можна тут:`,
      input.loginUrl,
      '',
      'Якщо ви не створювали цей акаунт, просто проігноруйте лист.',
    ].join('\n'),
  };
}
