import type { MailLocale } from './welcome-email.js';

export interface ProgramAssignedEmail {
  subject: string;
  text: string;
}

export function buildProgramAssignedEmail(input: {
  locale: MailLocale;
  kind: 'assigned' | 'updated';
  name: string;
  origin: 'system' | 'custom';
  frequencyPerWeek: number;
  days: { exercises: { name: string; nameEn: string }[] }[];
  workoutUrl: string;
}): ProgramAssignedEmail {
  const exercises = [
    ...new Set(
      input.days.flatMap((day) =>
        day.exercises.map((exercise) =>
          input.locale === 'en' ? exercise.nameEn : exercise.name,
        ),
      ),
    ),
  ];
  if (input.locale === 'en') {
    const origin = input.origin === 'system' ? 'System' : 'Custom';
    return {
      subject:
        input.kind === 'assigned'
          ? 'A new program has been assigned'
          : 'Your program has been updated',
      text: [
        input.kind === 'assigned'
          ? 'A new program has been assigned to you.'
          : 'Your program has been updated.',
        '',
        `Program: ${input.name}`,
        `Type: ${origin}`,
        `Training frequency: ${input.frequencyPerWeek} sessions a week`,
        'Exercises:',
        ...exercises.map((name) => `- ${name}`),
        '',
        'Open your workouts:',
        input.workoutUrl,
      ].join('\n'),
    };
  }

  const origin = input.origin === 'system' ? 'Системна' : 'Власна';
  return {
    subject:
      input.kind === 'assigned'
        ? 'Вам призначено нову програму'
        : 'Вашу програму оновлено',
    text: [
      input.kind === 'assigned'
        ? 'Вам призначено нову програму.'
        : 'Вашу програму оновлено.',
      '',
      `Програма: ${input.name}`,
      `Тип: ${origin}`,
      `Частота: ${input.frequencyPerWeek} тренування на тиждень`,
      'Вправи:',
      ...exercises.map((name) => `- ${name}`),
      '',
      'Відкрити тренування:',
      input.workoutUrl,
    ].join('\n'),
  };
}
