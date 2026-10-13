import type {
  AssignedProgramResponse,
  WorkoutLogListResponse,
} from '@repo/shared-types';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  dayLogCounts: [],
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
            nameEn: 'Not today',
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
            nameEn: 'Lat pulldown',
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
            nameEn: 'Crunch',
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
  beforeEach(() => {
    // jsdom has no layout; completing an exercise scrolls the page.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

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
      screen.queryByText('Вправа на прес · Опціонально'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Додати підхід/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Минулого разу')).not.toBeInTheDocument();
    expect(screen.queryByText('Варто збільшити вагу')).not.toBeInTheDocument();
    expect(screen.queryByText('Варто зменшити вагу')).not.toBeInTheDocument();
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
    expect(
      screen.getByText('01 — Тяга вертикального блоку'),
    ).toBeInTheDocument();
    expect(screen.getByText('35×12 • ×10')).toBeInTheDocument();
    expect(screen.getByText('02 — Скручування')).toBeInTheDocument();
    expect(screen.getByText('×15')).toBeInTheDocument();
    expect(screen.queryByText(/пред\./)).not.toBeInTheDocument();
    expect(screen.queryByText('Тривалість')).not.toBeInTheDocument();
    expect(screen.queryByText(/хв/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Результати збережено. Чудова робота!'),
    ).toBeInTheDocument();
    expect(screen.queryByText('ПРОГРЕС')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Повернутися до моєї програми →' }),
    ).toHaveAttribute('href', '/dashboard');
  });

  it('shows a fixed joint warm-up first and an abs card after the marked exercise', () => {
    renderSession();

    const warmup = screen.getByText('Суглобова розминка').closest('article')!;
    const first = screen
      .getByRole('button', { name: /Тяга вертикального блоку/ })
      .closest('article')!;
    const marked = screen
      .getByRole('button', { name: /Скручування/ })
      .closest('article')!;
    const abs = screen.getByText('Прес').closest('article')!;
    const finish = screen.getByRole('button', {
      name: 'Завершити тренування',
    });

    const following = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(warmup.compareDocumentPosition(first) & following).toBeTruthy();
    expect(first.compareDocumentPosition(marked) & following).toBeTruthy();
    expect(marked.compareDocumentPosition(abs) & following).toBeTruthy();
    expect(abs.compareDocumentPosition(finish) & following).toBeTruthy();
    expect(screen.getByText('5–7 хвилин перед першою вправою')).toBeVisible();
    expect(
      screen.getByText('За бажанням, після останньої вправи'),
    ).toBeVisible();
  });

  it('keeps the fixed cards unnumbered, disabled, and out of the counts', () => {
    renderSession();

    for (const [title, text] of [
      ['Суглобова розминка', '5–7 хвилин перед першою вправою'],
      ['Прес', 'За бажанням, після останньої вправи'],
    ]) {
      const card = screen.getByText(title!).closest('article')!;
      expect(card).toHaveAttribute('aria-disabled', 'true');
      expect(card).toHaveTextContent(`${title}${text}`);
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
      expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(card).queryByText(/^\d+$/)).not.toBeInTheDocument();
    }

    // Only the two real exercises are numbered, counted and fillable.
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.queryByText('03')).not.toBeInTheDocument();
    expect(screen.getByText('0 / 2 виконано')).toBeInTheDocument();
    expect(screen.getByText('2 вправ')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Тяга|Скручування/ }),
    ).toHaveLength(2);
  });

  it('shows only the warm-up on a day that does not end with abs', () => {
    program.nextDayNumber = 2;
    try {
      renderSession();

      expect(screen.getByText('Не сьогодні')).toBeInTheDocument();
      expect(screen.getByText('Суглобова розминка')).toBeInTheDocument();
      expect(screen.queryByText('Прес')).not.toBeInTheDocument();
      expect(
        screen.queryByText('За бажанням, після останньої вправи'),
      ).not.toBeInTheDocument();
    } finally {
      program.nextDayNumber = 1;
    }
  });

  it('translates the fixed cards', () => {
    render(
      <I18nTestProvider locale="en">
        <WorkoutSessionPage />
      </I18nTestProvider>,
    );

    expect(screen.getByText('Joint warm-up')).toBeInTheDocument();
    expect(
      screen.getByText('5–7 minutes before the first exercise'),
    ).toBeInTheDocument();
    expect(screen.getByText('Abs')).toBeInTheDocument();
    expect(
      screen.getByText('Optional, after the last exercise'),
    ).toBeInTheDocument();
  });

  it('names exercises in English in the session and the summary', async () => {
    const user = userEvent.setup();
    render(
      <I18nTestProvider locale="en">
        <WorkoutSessionPage />
      </I18nTestProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Lat pulldown/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crunch/ })).toBeInTheDocument();
    expect(
      screen.queryByText('Тяга вертикального блоку'),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Reps 1'), '12');
    await user.type(screen.getByLabelText('Reps 2'), '10');
    await user.click(screen.getByRole('button', { name: /Crunch/ }));
    await user.type(screen.getByLabelText('Reps 1'), '15');
    await user.click(screen.getByRole('button', { name: 'Finish workout' }));

    expect(await screen.findByText(/01 — Lat pulldown/)).toBeInTheDocument();
    expect(screen.getByText(/02 — Crunch/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Тяга вертикального блоку/),
    ).not.toBeInTheDocument();
  });

  it('does not log the fixed cards', async () => {
    const user = userEvent.setup();
    renderSession();

    await user.type(screen.getByLabelText('Вага 1'), '35');
    await user.type(screen.getByLabelText('Повтори 1'), '12');
    await user.type(screen.getByLabelText('Повтори 2'), '10');
    await user.click(screen.getByRole('button', { name: /Скручування/ }));
    await user.type(screen.getByLabelText('Повтори 1'), '15');
    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );

    expect(logWorkout).toHaveBeenCalledTimes(1);
    const submitted = logWorkout.mock.calls[0]![0] as {
      sets: { exerciseId: string; order: number }[];
    };
    // The warm-up and abs cards add nothing to what is saved.
    expect(submitted.sets).toHaveLength(3);
    expect(new Set(submitted.sets.map((set) => set.exerciseId))).toEqual(
      new Set([rowId, pressId]),
    );
    expect(Math.max(...submitted.sets.map((set) => set.order))).toBe(2);
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.queryByText('Суглобова розминка')).not.toBeInTheDocument();
  });

  it('asks before finishing with nothing recorded and keeps editing on dismiss', async () => {
    const user = userEvent.setup();
    renderSession();

    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Результати не записано',
    });
    expect(dialog.parentElement).toBe(document.body);
    expect(
      within(dialog).getByRole('link', { name: 'Завершити без запису' }),
    ).toHaveAttribute('href', '/dashboard');
    expect(logWorkout).not.toHaveBeenCalled();

    // Escape (like "keep filling in") returns to the session.
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Продовжити заповнення',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(logWorkout).not.toHaveBeenCalled();
  });

  it('logs a bodyweight set entered as 0 kg as reps only', async () => {
    const user = userEvent.setup();
    renderSession();

    await user.type(screen.getByLabelText('Вага 1'), '0');
    await user.type(screen.getByLabelText('Повтори 1'), '10');
    await user.type(screen.getByLabelText('Вага 2'), '0');
    await user.type(screen.getByLabelText('Повтори 2'), '8');
    await user.click(screen.getByRole('button', { name: /Скручування/ }));
    await user.type(screen.getByLabelText('Повтори 1'), '15');
    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      templateId,
      dayNumber: 1,
      sets: [
        { exerciseId: rowId, order: 1, setNumber: 1, repsCompleted: 10 },
        { exerciseId: rowId, order: 1, setNumber: 2, repsCompleted: 8 },
        { exerciseId: pressId, order: 2, setNumber: 1, repsCompleted: 15 },
      ],
    });
    expect(screen.getByText('×10 • ×8')).toBeInTheDocument();
    expect(screen.queryByText(/0×/)).not.toBeInTheDocument();
  });

  it('compares this session with the previous log for the same exercise', async () => {
    const user = userEvent.setup();
    const row = program.days[1]!.exercises[0]!.exercise;
    logs.current = {
      total: 2,
      logs: [
        {
          id: 'log-other-day',
          userId: 'user-1',
          templateId,
          dayNumber: 2,
          completedAt: '2026-10-01T10:00:00.000Z',
          sets: [
            {
              id: 'set-other',
              exerciseId: pressId,
              order: 2,
              setNumber: 1,
              repsCompleted: 11,
              weightKg: 20,
              recommendation: null,
              exercise: program.days[1]!.exercises[1]!.exercise,
            },
          ],
        },
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
              recommendation: null,
              exercise: row,
            },
            {
              id: 'set-2',
              exerciseId: rowId,
              order: 1,
              setNumber: 2,
              repsCompleted: 8,
              weightKg: null,
              recommendation: null,
              exercise: row,
            },
          ],
        },
      ],
    };
    renderSession();

    await user.type(screen.getByLabelText('Вага 1'), '35');
    await user.type(screen.getByLabelText('Повтори 1'), '12');
    await user.type(screen.getByLabelText('Повтори 2'), '10');
    await user.click(screen.getByRole('button', { name: /Скручування/ }));
    await user.type(screen.getByLabelText('Повтори 1'), '15');
    await user.click(
      screen.getByRole('button', { name: 'Завершити тренування' }),
    );

    expect(
      screen.getByText('01 — Тяга вертикального блоку'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent === 'пред. 32.5×10 • ×8',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('35×12 • ×10')).toBeInTheDocument();
    const press = screen.getByText('02 — Скручування').parentElement;
    expect(press).toHaveTextContent('×15');
    expect(press).not.toHaveTextContent('пред.');
    expect(screen.queryByText('20×11')).not.toBeInTheDocument();
    expect(screen.queryByText('Тривалість')).not.toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
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
              recommendation: null,
              exercise: program.days[1]!.exercises[0]!.exercise,
            },
          ],
        },
      ],
    };

    renderSession();

    expect(screen.getByText('Минулого разу')).toBeInTheDocument();
    expect(screen.getByText('32.5 кг × 10')).toBeInTheDocument();
    expect(screen.queryByText('Варто збільшити вагу')).not.toBeInTheDocument();
    expect(screen.queryByText('Варто зменшити вагу')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Вага 1')).toHaveValue('');
  });

  it('shows the recommendation from the last set of this day', async () => {
    const user = userEvent.setup();
    const row = program.days[1]!.exercises[0]!.exercise;
    const press = program.days[1]!.exercises[1]!.exercise;
    logs.current = {
      total: 2,
      logs: [
        {
          id: 'log-other-day',
          userId: 'user-1',
          templateId,
          dayNumber: 2,
          completedAt: '2026-10-01T10:00:00.000Z',
          sets: [
            {
              id: 'set-other',
              exerciseId: rowId,
              order: 1,
              setNumber: 1,
              repsCompleted: 9,
              weightKg: 20,
              recommendation: 'decrease',
              exercise: row,
            },
          ],
        },
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
              repsCompleted: 8,
              weightKg: 30,
              recommendation: null,
              exercise: row,
            },
            {
              id: 'set-2',
              exerciseId: rowId,
              order: 1,
              setNumber: 2,
              repsCompleted: 12,
              weightKg: 32.5,
              recommendation: 'increase',
              exercise: row,
            },
            {
              id: 'set-3',
              exerciseId: pressId,
              order: 2,
              setNumber: 1,
              repsCompleted: 11,
              weightKg: null,
              recommendation: 'decrease',
              exercise: press,
            },
          ],
        },
      ],
    };

    renderSession();

    expect(screen.getByText('30 кг × 8 • 32.5 кг × 12')).toBeInTheDocument();
    expect(screen.getByText('Варто збільшити вагу')).toBeInTheDocument();
    expect(screen.queryByText('Варто зменшити вагу')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Вага 1')).toHaveValue('');
    expect(screen.getByLabelText('Вага 2')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: /Скручування/ }));

    expect(screen.getByText('× 11')).toBeInTheDocument();
    expect(screen.getByText('Варто зменшити вагу')).toBeInTheDocument();
    expect(screen.queryByText('Варто збільшити вагу')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Вага 1')).toHaveValue('');
    expect(screen.getByLabelText('Повтори 1')).toHaveValue('');
  });

  describe('scrolling to the next exercise', () => {
    const headerHeight = 120;
    const cardTop = 500;
    let scrollTo: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(
        headerHeight,
      );
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: Element) {
          return {
            top: this.tagName === 'ARTICLE' ? cardTop : 0,
          } as DOMRect;
        },
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('puts the next exercise just under the sticky header', async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(
        screen.getByRole('button', { name: 'Завершити вправу' }),
      );

      expect(screen.getByLabelText('Повтори 1')).toBeInTheDocument();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({
        top: cardTop - headerHeight - 8,
        behavior: 'smooth',
      });
    });

    it('skips the animation when the user prefers reduced motion', async () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      const user = userEvent.setup();
      renderSession();

      await user.click(
        screen.getByRole('button', { name: 'Завершити вправу' }),
      );

      expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'auto' }),
      );
    });

    it('does not scroll when a card is opened by hand', async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(screen.getByRole('button', { name: /Скручування/ }));
      await user.click(
        screen.getByRole('button', { name: /Тяга вертикального блоку/ }),
      );

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does not scroll after the last exercise', async () => {
      const user = userEvent.setup();
      renderSession();

      await user.click(
        screen.getByRole('button', { name: 'Завершити вправу' }),
      );
      scrollTo.mockClear();
      await user.click(
        screen.getByRole('button', { name: 'Завершити вправу' }),
      );

      expect(scrollTo).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/^Вага/)).not.toBeInTheDocument();
    });
  });
});
