import type {
  AssignedProgramResponse,
  WorkoutLogListResponse,
} from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { WorkoutSessionPage } from './workout-session-page';

const templateId = '11111111-1111-4111-8111-111111111111';
const rowId = '44444444-4444-4444-8444-444444444444';
const pressId = '55555555-5555-4555-8555-555555555555';

const program: AssignedProgramResponse = {
  id: 'program-1',
  templateId,
  templateCode: 'WB2U',
  templateName: 'WB2U',
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  assignedAt: '2026-09-27T00:00:00.000Z',
  nextDayNumber: 1,
  programProgress: { completed: 0, expected: 16 },
  days: [
    {
      dayNumber: 2,
      exercises: [
        {
          order: 1,
          sets: 1,
          allowsAbsAddon: false,
          exercise: {
            id: '66666666-6666-4666-8666-666666666666',
            code: 'EX_001',
            name: 'Не сьогодні',
            muscleGroups: ['CHEST'],
            repsMin: 8,
            repsMax: 10,
          },
        },
      ],
    },
    {
      dayNumber: 1,
      exercises: [
        {
          order: 1,
          sets: 2,
          allowsAbsAddon: false,
          exercise: {
            id: rowId,
            code: 'EX_039',
            name: 'Тяга вертикального блоку',
            muscleGroups: ['BACK'],
            repsMin: 10,
            repsMax: 12,
          },
        },
        {
          order: 2,
          sets: 1,
          allowsAbsAddon: true,
          exercise: {
            id: pressId,
            code: 'EX_070',
            name: 'Скручування',
            muscleGroups: ['ABS'],
            repsMin: 15,
            repsMax: 20,
          },
        },
      ],
    },
  ],
};

const logs = vi.hoisted(() => ({
  current: { logs: [], total: 0 } as WorkoutLogListResponse,
}));

const logWorkout = vi.hoisted(() => vi.fn());

vi.mock('@/lib/hooks/use-programs', () => ({
  useMyProgram: () => ({
    data: program,
    isPending: false,
    isFetched: true,
  }),
}));

vi.mock('@/lib/hooks/use-workouts', () => ({
  useWorkoutLogs: () => ({ data: logs.current }),
  useLogWorkout: () => ({
    mutateAsync: logWorkout,
    isPending: false,
  }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderSession() {
  return render(
    <I18nTestProvider>
      <WorkoutSessionPage />
    </I18nTestProvider>,
  );
}

describe('WorkoutSessionPage', () => {
  afterEach(() => {
    cleanup();
    logs.current = { logs: [], total: 0 };
    logWorkout.mockReset();
    logWorkout.mockResolvedValue({ id: 'log-1' });
  });

  it('logs every prescribed set and leaves extra rows out', async () => {
    const user = userEvent.setup();
    renderSession();

    expect(
      screen.getByRole('heading', { name: 'Тренування 01' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Тяга вертикального блоку')).toBeInTheDocument();
    expect(screen.queryByText('Не сьогодні')).not.toBeInTheDocument();
    expect(screen.getByText('Скручування')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Вага/)).toHaveLength(2);
    expect(
      screen.getByText('Вправа на прес · Опціонально'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Додати підхід/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Минулого разу')).not.toBeInTheDocument();
    expect(screen.queryByText('ПРОГРЕС')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Вага 1'), '35');
    await user.type(screen.getByLabelText('Повтори 1'), '12');
    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );

    expect(logWorkout).not.toHaveBeenCalled();
    expect(
      screen.getByText('Заповни повторення в кожному підході.'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Повтори 2'), '10');
    await user.click(screen.getByRole('button', { name: /Скручування/ }));
    await user.type(screen.getByLabelText('Повтори 1'), '15');
    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      templateId,
      dayNumber: 1,
      sets: [
        {
          exerciseId: rowId,
          order: 1,
          setNumber: 1,
          repsCompleted: 12,
          weightKg: 35,
        },
        {
          exerciseId: rowId,
          order: 1,
          setNumber: 2,
          repsCompleted: 10,
        },
        {
          exerciseId: pressId,
          order: 2,
          setNumber: 1,
          repsCompleted: 15,
        },
      ],
    });
    expect(
      screen.getByRole('heading', { name: 'Тренування завершено' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('Тривалість')).not.toBeInTheDocument();
    expect(
      screen.getByText('Результати збережено. Чудова робота!'),
    ).toBeInTheDocument();
    expect(screen.queryByText('ПРОГРЕС')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Повернутися до моєї програми →' }),
    ).toHaveAttribute('href', '/dashboard');
  });

  it('lets a filled exercise be reopened and corrected before submit', async () => {
    const user = userEvent.setup();
    renderSession();

    await user.type(screen.getByLabelText('Вага 1'), '35');
    await user.type(screen.getByLabelText('Повтори 1'), '12');
    await user.type(screen.getByLabelText('Повтори 2'), '10');
    expect(screen.getByText('1 / 2 виконано')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Завершити вправу' }));
    expect(screen.getAllByLabelText(/^Вага/)).toHaveLength(1);

    await user.click(
      screen.getByRole('button', { name: /Тяга вертикального блоку/ }),
    );
    expect(screen.getByLabelText('Вага 1')).toHaveValue('35');
    expect(screen.getByLabelText('Повтори 1')).toHaveValue('12');
    expect(screen.getByLabelText('Повтори 2')).toHaveValue('10');

    await user.clear(screen.getByLabelText('Вага 1'));
    await user.type(screen.getByLabelText('Вага 1'), '40');
    await user.clear(screen.getByLabelText('Повтори 1'));
    await user.type(screen.getByLabelText('Повтори 1'), '8');

    await user.click(screen.getByRole('button', { name: /Скручування/ }));
    expect(screen.queryByDisplayValue('40')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Тяга вертикального блоку/ }),
    );
    expect(screen.getByLabelText('Вага 1')).toHaveValue('40');
    expect(screen.getByLabelText('Повтори 2')).toHaveValue('10');

    await user.click(screen.getByRole('button', { name: /Скручування/ }));
    await user.type(screen.getByLabelText('Повтори 1'), '15');
    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      templateId,
      dayNumber: 1,
      sets: [
        {
          exerciseId: rowId,
          order: 1,
          setNumber: 1,
          repsCompleted: 8,
          weightKg: 40,
        },
        {
          exerciseId: rowId,
          order: 1,
          setNumber: 2,
          repsCompleted: 10,
        },
        {
          exerciseId: pressId,
          order: 2,
          setNumber: 1,
          repsCompleted: 15,
        },
      ],
    });
  });

  it('shows last time only for an exercise that was logged', () => {
    logs.current = {
      total: 1,
      logs: [
        {
          id: 'log-1',
          userId: 'user-1',
          templateId,
          dayNumber: 1,
          completedAt: '2026-09-30T10:00:00.000Z',
          sets: [
            {
              id: 'set-1',
              exerciseId: rowId,
              order: 1,
              setNumber: 1,
              repsCompleted: 10,
              weightKg: 32.5,
              exercise: program.days[1]!.exercises[0]!.exercise,
            },
          ],
        },
      ],
    };

    renderSession();

    expect(screen.getByText('Минулого разу')).toBeInTheDocument();
    expect(screen.getByText('32.5 кг × 10')).toBeInTheDocument();
  });
});
