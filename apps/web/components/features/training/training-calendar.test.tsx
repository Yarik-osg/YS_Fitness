import type { WorkoutLogResponse } from '@repo/shared-types';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { TrainingCalendar } from './training-calendar';

// Sunday 11 October 2026, local time. The week is Mon 5 to Sun 11 October.
const NOW = new Date(2026, 9, 11, 12, 0, 0);

const rowId = '44444444-4444-4444-8444-444444444444';
const pressId = '55555555-5555-4555-8555-555555555555';

function exercise(id: string, name: string) {
  return {
    id,
    code: name,
    name,
    muscleGroups: ['BACK' as const],
    repsMin: 10,
    repsMax: 12,
  };
}

function set(
  logId: string,
  exerciseId: string,
  name: string,
  order: number,
  setNumber: number,
  repsCompleted: number,
  weightKg: number | null,
) {
  return {
    id: `${logId}-${exerciseId}-${setNumber}`,
    exerciseId,
    order,
    setNumber,
    repsCompleted,
    weightKg,
    recommendation: null,
    exercise: exercise(exerciseId, name),
  };
}

function log(
  id: string,
  dayNumber: number,
  completedAt: Date,
  sets: WorkoutLogResponse['sets'],
): WorkoutLogResponse {
  return {
    id,
    userId: 'user-1',
    templateId: '11111111-1111-4111-8111-111111111111',
    dayNumber,
    completedAt: completedAt.toISOString(),
    sets,
  };
}

const LOGS = [
  log('a', 1, new Date(2026, 9, 7, 14, 5), [
    set('a', rowId, 'Тяга вертикального блоку', 1, 1, 12, 35),
    set('a', rowId, 'Тяга вертикального блоку', 1, 2, 10, null),
    set('a', pressId, 'Скручування', 2, 1, 15, null),
  ]),
  log('b', 2, new Date(2026, 9, 7, 19, 30), [
    set('b', rowId, 'Тяга вертикального блоку', 1, 1, 8, 40),
  ]),
  log('c', 1, new Date(2026, 8, 30, 9, 0), [
    set('c', pressId, 'Скручування', 1, 1, 20, null),
  ]),
  log('d', 2, new Date(2026, 8, 15, 18, 0), [
    set('d', rowId, 'Тяга вертикального блоку', 1, 1, 11, 30),
  ]),
];

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
  usePathname: () => '/training',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Stubs fetch with a server that answers by the requested [from, to) range. */
function stubCalendarApi(options: { failFirst?: boolean } = {}) {
  const requests: { from: string; to: string }[] = [];
  let failed = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (!url.pathname.endsWith('/workouts/calendar')) {
        return json({}, 404);
      }
      const from = url.searchParams.get('from')!;
      const to = url.searchParams.get('to')!;
      requests.push({ from, to });
      if (options.failFirst && !failed) {
        failed = true;
        return json({ code: 'INTERNAL_SERVER_ERROR', message: 'failed' }, 500);
      }
      const logs = LOGS.filter(
        (entry) => entry.completedAt >= from && entry.completedAt < to,
      ).sort((left, right) =>
        left.completedAt.localeCompare(right.completedAt),
      );
      return json({ logs });
    }),
  );
  return requests;
}

function renderCalendar(
  locale: 'uk' | 'en' = 'uk',
  props: ComponentProps<typeof TrainingCalendar> = {},
) {
  return render(
    <Providers>
      <I18nTestProvider locale={locale}>
        <TrainingCalendar {...props} />
      </I18nTestProvider>
    </Providers>,
  );
}

const LONG_AGO = new Date(2026, 0, 1, 9).toISOString();

function local(year: number, month: number, day: number) {
  return new Date(year, month, day).toISOString();
}

describe('TrainingCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('marks the days trained this week and today', async () => {
    const requests = stubCalendarApi();
    renderCalendar();

    expect(
      await screen.findByRole('button', { name: '7 жовтня, 2 тренування' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Цього тижня')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^\d+ жовтня, / }),
    ).toHaveLength(7);
    expect(
      screen.getByRole('button', { name: '5 жовтня, без тренувань' }),
    ).toBeInTheDocument();

    const today = screen.getByRole('button', {
      name: '11 жовтня, без тренувань',
    });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: '7 жовтня, 2 тренування' }),
    ).not.toHaveAttribute('aria-current');

    // Only the current week is requested until the month is opened.
    expect(requests).toEqual([
      { from: local(2026, 9, 5), to: local(2026, 9, 12) },
    ]);
  });

  it('shows what was done on the day that is tapped', async () => {
    const user = userEvent.setup();
    stubCalendarApi();
    renderCalendar();

    expect(await screen.findByText('неділя, 11 жовтня')).toBeInTheDocument();
    expect(
      await screen.findByText('У цей день тренувань не було.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '7 жовтня, 2 тренування' }),
    );

    expect(screen.getByText('середа, 7 жовтня')).toBeInTheDocument();
    // Like the program day cards, logged workouts start collapsed and show
    // only the title, the time, and how many exercises were done.
    const first = screen.getByRole('button', { name: /Тренування 01 · 14:05/ });
    const second = screen.getByRole('button', {
      name: /Тренування 02 · 19:30/,
    });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(first).toHaveTextContent('2');
    expect(first).toHaveTextContent('вправ');
    expect(second).toHaveTextContent('1');
    expect(screen.queryByText('35×12 • ×10')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Тяга вертикального блоку'),
    ).not.toBeInTheDocument();

    await user.click(first);

    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('35×12 • ×10')).toBeInTheDocument();
    expect(screen.getByText('×15')).toBeInTheDocument();
    expect(screen.getByText('Тяга вертикального блоку')).toBeInTheDocument();
    expect(screen.getByText('Скручування')).toBeInTheDocument();
    expect(screen.queryByText('40×8')).not.toBeInTheDocument();

    await user.click(second);

    expect(screen.getByText('40×8')).toBeInTheDocument();
    expect(screen.getAllByText('Тяга вертикального блоку')).toHaveLength(2);

    await user.click(first);

    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('35×12 • ×10')).not.toBeInTheDocument();
    expect(screen.getByText('40×8')).toBeInTheDocument();
    expect(
      screen.queryByText('У цей день тренувань не було.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '7 жовтня, 2 тренування' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: '11 жовтня, без тренувань' }),
    ).toHaveAttribute('aria-pressed', 'false');

    await user.click(
      screen.getByRole('button', { name: '8 жовтня, без тренувань' }),
    );

    expect(screen.getByText('четвер, 8 жовтня')).toBeInTheDocument();
    expect(
      screen.getByText('У цей день тренувань не було.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Тренування 01/)).not.toBeInTheDocument();
  });

  it('opens a month grid and loads the whole grid range', async () => {
    const user = userEvent.setup();
    const requests = stubCalendarApi();
    renderCalendar();
    await screen.findByRole('button', { name: '7 жовтня, 2 тренування' });

    const toggle = screen.getByRole('button', { name: 'Показати місяць' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Показати тиждень' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('жовтень 2026')).toBeInTheDocument();
    expect(screen.queryByText('Цього тижня')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: '30 вересня, 1 тренування' }),
    ).toBeInTheDocument();
    // Whole weeks: Mon 28 September to Sun 1 November, 35 days.
    expect(
      screen.getAllByRole('button', { name: /(жовтня|вересня|листопада), / }),
    ).toHaveLength(35);
    expect(
      screen.getByRole('button', { name: '1 жовтня, без тренувань' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '1 листопада, без тренувань' }),
    ).toBeInTheDocument();
    expect(requests).toContainEqual({
      from: local(2026, 8, 28),
      to: local(2026, 10, 2),
    });

    // A day from the previous month that is shown in the grid is selectable.
    await user.click(
      screen.getByRole('button', { name: '30 вересня, 1 тренування' }),
    );
    expect(screen.getByText('середа, 30 вересня')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Тренування 01 · 09:00/ }),
    );
    expect(screen.getByText('×20')).toBeInTheDocument();
  });

  it('goes to the previous month, refetches, and cannot pass this month', async () => {
    const user = userEvent.setup();
    const requests = stubCalendarApi();
    renderCalendar();
    await user.click(
      await screen.findByRole('button', { name: 'Показати місяць' }),
    );

    const next = screen.getByRole('button', { name: 'Наступний місяць' });
    expect(next).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Попередній місяць' }));

    expect(screen.getByText('вересень 2026')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Наступний місяць' }),
    ).toBeEnabled();
    // Selection moves into the shown month, so details always match the grid.
    expect(screen.getByText('вівторок, 1 вересня')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: '15 вересня, 1 тренування' }),
    ).toBeInTheDocument();
    // Whole weeks: Mon 31 August to Sun 4 October.
    expect(requests).toContainEqual({
      from: local(2026, 7, 31),
      to: local(2026, 9, 5),
    });

    await user.click(
      screen.getByRole('button', { name: '15 вересня, 1 тренування' }),
    );
    await user.click(
      screen.getByRole('button', { name: /Тренування 02 · 18:00/ }),
    );
    expect(screen.getByText('30×11')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Наступний місяць' }));

    expect(screen.getByText('жовтень 2026')).toBeInTheDocument();
    expect(screen.getByText('неділя, 11 жовтня')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Наступний місяць' }),
    ).toBeDisabled();
  });

  it('returns to the week strip and today', async () => {
    const user = userEvent.setup();
    stubCalendarApi();
    renderCalendar();
    await user.click(
      await screen.findByRole('button', { name: 'Показати місяць' }),
    );
    await user.click(screen.getByRole('button', { name: 'Попередній місяць' }));

    await user.click(screen.getByRole('button', { name: 'Показати тиждень' }));

    expect(screen.getByText('Цього тижня')).toBeInTheDocument();
    expect(screen.getByText('неділя, 11 жовтня')).toBeInTheDocument();
    expect(screen.queryByText('вересень 2026')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: '7 жовтня, 2 тренування' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^\d+ жовтня, / }),
    ).toHaveLength(7);
  });

  it('shows a quiet error with a retry and recovers', async () => {
    const user = userEvent.setup();
    const requests = stubCalendarApi({ failFirst: true });
    renderCalendar();

    expect(
      await screen.findByText('Не вдалося завантажити календар.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('У цей день тренувань не було.'),
    ).not.toBeInTheDocument();
    // The strip itself still renders.
    expect(
      screen.getByRole('button', { name: '7 жовтня, без тренувань' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ще раз' }));

    expect(
      await screen.findByRole('button', { name: '7 жовтня, 2 тренування' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Не вдалося завантажити календар.'),
    ).not.toBeInTheDocument();
    expect(requests).toHaveLength(2);
  });

  it('renders English labels, dates, and times', async () => {
    const user = userEvent.setup();
    stubCalendarApi();
    renderCalendar('en');

    expect(await screen.findByText('This week')).toBeInTheDocument();
    expect(await screen.findByText('Sunday, October 11')).toBeInTheDocument();
    const day = await screen.findByRole('button', {
      name: 'October 7, 2 workouts',
    });
    expect(
      screen.getByRole('button', { name: 'October 11, no workouts' }),
    ).toBeInTheDocument();

    await user.click(day);

    expect(screen.getByText('Wednesday, October 7')).toBeInTheDocument();
    expect(screen.getByText(/^Workout 01 · 02:05\s?PM$/)).toBeInTheDocument();
    expect(screen.getByText(/^Workout 02 · 07:30\s?PM$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show month' }));

    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous month' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    const grid = within(
      screen.getByRole('button', { name: 'Show week' }).closest('section')!,
    );
    expect(
      await grid.findByRole('button', { name: 'September 30, 1 workout' }),
    ).toBeInTheDocument();
  });

  it('marks the recommended training days of a three-day program', async () => {
    const user = userEvent.setup();
    stubCalendarApi();
    renderCalendar('uk', { frequencyPerWeek: 3, assignedAt: LONG_AGO });

    // Mon 5, Wed 7 and Fri 9 October, whether or not they were trained.
    const recommended = await screen.findAllByRole('button', {
      name: /Рекомендований день/,
    });
    expect(recommended).toHaveLength(3);
    expect(
      screen.getByRole('button', {
        name: '5 жовтня, без тренувань, Рекомендований день',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {
        name: '7 жовтня, 2 тренування, Рекомендований день',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '9 жовтня, без тренувань, Рекомендований день',
      }),
    ).toBeInTheDocument();
    for (const name of [
      '6 жовтня, без тренувань',
      '8 жовтня, без тренувань',
      '10 жовтня, без тренувань',
      '11 жовтня, без тренувань',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    // The selected day says so too, next to the date.
    expect(screen.queryByText('Рекомендований день')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: '9 жовтня, без тренувань, Рекомендований день',
      }),
    );
    expect(screen.getByText('пʼятниця, 9 жовтня')).toBeInTheDocument();
    expect(screen.getByText('Рекомендований день')).toBeInTheDocument();
    // It is already past and nothing was logged, so the usual line applies.
    expect(
      screen.getByText('У цей день тренувань не було.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '8 жовтня, без тренувань' }),
    );
    expect(screen.queryByText('Рекомендований день')).not.toBeInTheDocument();
  });

  it('recommends Tuesday and Thursday for two days and four weekdays for four', async () => {
    const user = userEvent.setup();
    stubCalendarApi();
    const two = renderCalendar('uk', {
      frequencyPerWeek: 2,
      assignedAt: LONG_AGO,
    });
    expect(
      await screen.findAllByRole('button', { name: /Рекомендований день/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /^6 жовтня, .*Рекомендований день/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^8 жовтня, .*Рекомендований день/ }),
    ).toBeInTheDocument();
    two.unmount();

    renderCalendar('uk', { frequencyPerWeek: 4, assignedAt: LONG_AGO });
    expect(
      await screen.findAllByRole('button', { name: /Рекомендований день/ }),
    ).toHaveLength(4);
    for (const day of [5, 6, 8, 9]) {
      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${day} жовтня, .*Рекомендований день`),
        }),
      ).toBeInTheDocument();
    }

    // The month grid carries the same weekday pattern: Mon, Tue, Thu, Fri of
    // the five weeks from 28 September to 1 November.
    await user.click(screen.getByRole('button', { name: 'Показати місяць' }));
    expect(
      await screen.findAllByRole('button', { name: /Рекомендований день/ }),
    ).toHaveLength(20);
  });

  it('does not recommend days before the program was assigned', async () => {
    stubCalendarApi();
    // Assigned on Wednesday 7 October, late in the evening.
    renderCalendar('uk', {
      frequencyPerWeek: 3,
      assignedAt: new Date(2026, 9, 7, 23, 30).toISOString(),
    });

    const recommended = await screen.findAllByRole('button', {
      name: /Рекомендований день/,
    });
    expect(recommended).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /^7 жовтня, .*Рекомендований день/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '5 жовтня, без тренувань' }),
    ).toBeInTheDocument();
  });

  it('does not say a coming day had no workouts', async () => {
    const user = userEvent.setup();
    // Wednesday 7 October, so Thursday and Friday are still ahead.
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
    stubCalendarApi();
    renderCalendar('uk', { frequencyPerWeek: 3, assignedAt: LONG_AGO });

    // Today is recommended and has workouts that already happened.
    expect(await screen.findByText('середа, 7 жовтня')).toBeInTheDocument();
    expect(await screen.findByText('Рекомендований день')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Тренування 01 · 14:05/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '9 жовтня, без тренувань, Рекомендований день',
      }),
    );
    expect(screen.getByText('пʼятниця, 9 жовтня')).toBeInTheDocument();
    expect(screen.getByText('Рекомендований день')).toBeInTheDocument();
    expect(
      screen.queryByText('У цей день тренувань не було.'),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '8 жовтня, без тренувань' }),
    );
    expect(screen.getByText('четвер, 8 жовтня')).toBeInTheDocument();
    expect(screen.queryByText('Рекомендований день')).not.toBeInTheDocument();
    expect(
      screen.queryByText('У цей день тренувань не було.'),
    ).not.toBeInTheDocument();

    // A day that has passed still gets the line.
    await user.click(
      screen.getByRole('button', { name: '6 жовтня, без тренувань' }),
    );
    expect(
      screen.getByText('У цей день тренувань не було.'),
    ).toBeInTheDocument();
  });

  it('labels recommended days in English', async () => {
    stubCalendarApi();
    renderCalendar('en', { frequencyPerWeek: 2, assignedAt: LONG_AGO });

    expect(
      await screen.findByRole('button', {
        name: 'October 6, no workouts, Recommended day',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'October 8, no workouts, Recommended day',
      }),
    ).toBeInTheDocument();
  });

  it('keeps a late-evening workout on its local day', async () => {
    const lateLog = log('late', 1, new Date(2026, 9, 6, 23, 50), [
      set('late', rowId, 'Тяга вертикального блоку', 1, 1, 12, 20),
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ logs: [lateLog] })),
    );
    renderCalendar();

    expect(
      await screen.findByRole('button', { name: '6 жовтня, 1 тренування' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '7 жовтня, без тренувань' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
