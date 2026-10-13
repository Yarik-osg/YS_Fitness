import type { AssignedProgramResponse } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { useAuthStore } from '@/lib/stores/auth-store';
import { I18nTestProvider } from '@/test/i18n';
import { TrainingPage } from './training-page';

const routerReplace = vi.hoisted(() => vi.fn());

const PROGRAM = {
  id: 'program-1',
  templateId: '11111111-1111-4111-8111-111111111111',
  templateCode: 'WB2U',
  templateName: 'WB2U — верх',
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  assignedAt: '2026-09-27T00:00:00.000Z',
  nextDayNumber: 2,
  programProgress: { completed: 3, expected: 16 },
  dayLogCounts: [{ dayNumber: 1, count: 3 }],
  days: [
    {
      dayNumber: 2,
      exercises: [
        {
          order: 1,
          sets: 3,
          allowsAbsAddon: true,
          exercise: {
            id: '55555555-5555-4555-8555-555555555555',
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
    {
      dayNumber: 1,
      exercises: [
        {
          order: 1,
          sets: 3,
          allowsAbsAddon: false,
          exercise: {
            id: '44444444-4444-4444-8444-444444444444',
            code: 'EX_039',
            name: 'Тяга вертикального блоку',
            nameEn: 'Lat pulldown',
            muscleGroups: ['BACK', 'BICEPS'],
            repsMin: 10,
            repsMax: 12,
          },
        },
        {
          order: 2,
          sets: 3,
          allowsAbsAddon: false,
          exercise: {
            id: '66666666-6666-4666-8666-666666666666',
            code: 'EX_008',
            name: 'Жим гантелей вгору сидячи',
            nameEn: 'Seated dumbbell shoulder press',
            muscleGroups: ['SHOULDERS'],
            repsMin: 10,
            repsMax: 12,
          },
        },
      ],
    },
  ],
} satisfies AssignedProgramResponse;

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
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

function renderPage(locale: 'uk' | 'en' = 'uk') {
  return render(
    <Providers>
      <I18nTestProvider locale={locale}>
        <TrainingPage />
      </I18nTestProvider>
    </Providers>,
  );
}

function signIn() {
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'token',
    user: {
      id: 'user-1',
      email: 'alina@example.com',
      role: 'CLIENT',
      name: 'Аліна К.',
      onboardingCompletedAt: '2026-09-01T00:00:00.000Z',
    },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TrainingPage', () => {
  it('shows a skeleton instead of the program while it loads', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    signIn();
    renderPage();

    expect(
      screen.getByRole('main', { name: 'Завантажуємо програму' }),
    ).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.queryByRole('heading', { name: 'Тренування' }),
    ).not.toBeInTheDocument();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.getState().clearSession();
  });

  it('lists every day, counts this cycle, and starts only the next day', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/programs/me')) {
          return json({ program: PROGRAM });
        }
        return json({}, 404);
      }),
    );
    signIn();
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Тренування' }),
    ).toBeInTheDocument();
    expect(screen.getByText('WB2U — верх')).toBeInTheDocument();
    expect(screen.getByText('Спина · Біцепс · Плечі')).toBeInTheDocument();
    expect(
      screen.queryByText('Тяга вертикального блоку'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Жим гантелей вгору сидячи'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Скручування')).toBeInTheDocument();
    expect(screen.getAllByText('Прес')).toHaveLength(2);
    expect(screen.getByText('3 × 15–20')).toBeInTheDocument();
    expect(screen.getAllByText('вправ')).toHaveLength(2);
    expect(
      screen.getByText('Виконано: 3 рази цього циклу'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Виконано: 0 разів цього циклу'),
    ).toBeInTheDocument();
    expect(screen.getByText('Наступне')).toBeInTheDocument();
    expect(screen.queryByText(/Тиждень/)).not.toBeInTheDocument();

    const dayOne = screen.getByRole('heading', { name: 'Тренування 01' });
    const dayTwo = screen.getByRole('heading', { name: 'Тренування 02' });
    const dayOneToggle = screen.getByRole('button', { name: /Тренування 01/ });
    const dayTwoToggle = screen.getByRole('button', { name: /Тренування 02/ });
    expect(dayOne.compareDocumentPosition(dayTwo)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(dayOneToggle).toHaveAttribute('aria-expanded', 'false');
    expect(dayOneToggle).toHaveTextContent('2');
    expect(dayOneToggle).toHaveTextContent('вправ');
    expect(dayTwoToggle).toHaveAttribute('aria-expanded', 'true');
    expect(dayTwoToggle).toHaveTextContent('1');
    expect(dayOne.closest('a')).toBeNull();
    expect(dayTwo.closest('a')).toBeNull();

    const starts = screen.getAllByRole('link', {
      name: 'Почати тренування →',
    });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toHaveAttribute('href', '/workout');
    expect(starts[0]?.closest('article')).toContainElement(dayTwo);
    expect(starts[0]?.closest('article')).not.toContainElement(dayOne);

    await user.click(dayOneToggle);
    expect(dayOneToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Тяга вертикального блоку')).toBeInTheDocument();
    expect(screen.getByText('Спина · Біцепс')).toBeInTheDocument();
    expect(screen.getByText('Жим гантелей вгору сидячи')).toBeInTheDocument();
    expect(screen.getByText('Плечі')).toBeInTheDocument();
    expect(screen.getAllByText('3 × 10–12')).toHaveLength(2);

    await user.click(dayOneToggle);
    expect(dayOneToggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText('Тяга вертикального блоку'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Жим гантелей вгору сидячи'),
    ).not.toBeInTheDocument();
  });

  it('lists the exercises with their English names in the English locale', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/programs/me')) {
          return json({ program: PROGRAM });
        }
        return json({}, 404);
      }),
    );
    signIn();
    renderPage('en');

    expect(await screen.findByText('Crunch')).toBeInTheDocument();
    expect(screen.queryByText('Скручування')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Workout 01/ }));

    expect(screen.getByText('Lat pulldown')).toBeInTheDocument();
    expect(
      screen.getByText('Seated dumbbell shoulder press'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Тяга вертикального блоку'),
    ).not.toBeInTheDocument();
  });

  it('shows the calendar between the program banner and the day cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/me')) return json({ program: PROGRAM });
        if (url.includes('/workouts/calendar')) return json({ logs: [] });
        return json({}, 404);
      }),
    );
    signIn();
    renderPage();

    const banner = await screen.findByText('WB2U — верх');
    const calendar = await screen.findByText('Цього тижня');
    const firstDay = screen.getByRole('heading', { name: 'Тренування 01' });

    expect(banner.compareDocumentPosition(calendar)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(calendar.compareDocumentPosition(firstDay)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      await screen.findByText('У цей день тренувань не було.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Показати місяць' }),
    ).toBeInTheDocument();
  });

  it('marks the recommended days for the assigned program frequency', async () => {
    // Sunday 11 October 2026. The fixture is a two-day program assigned on
    // 27 September, so this week's Tuesday and Thursday are recommended.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0));
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('/programs/me')) return json({ program: PROGRAM });
          if (url.includes('/workouts/calendar')) return json({ logs: [] });
          return json({}, 404);
        }),
      );
      signIn();
      renderPage();

      expect(
        await screen.findByRole('button', {
          name: '6 жовтня, без тренувань, Рекомендований день',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: '8 жовтня, без тренувань, Рекомендований день',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: /Рекомендований день/ }),
      ).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses the assign-program action when nothing is assigned', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/programs/assign')) {
          expect(init?.method).toBe('POST');
          return json(PROGRAM);
        }
        if (url.includes('/programs/me')) return json({ program: null });
        return json({}, 404);
      }),
    );
    signIn();
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Призначити мою програму' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Почати тренування →' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Цього тижня')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Призначити мою програму' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Тренування 02' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Почати тренування →' }),
    ).toHaveAttribute('href', '/workout');
  });

  it('links to checkout when the program needs a subscription', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/programs/me')) {
          return json(
            {
              code: 'SUBSCRIPTION_REQUIRED',
              message: 'An active subscription is required',
            },
            403,
          );
        }
        return json({}, 404);
      }),
    );
    signIn();
    renderPage();

    expect(
      await screen.findByRole('link', { name: 'Обрати план' }),
    ).toHaveAttribute('href', '/checkout');
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Почати тренування →' }),
    ).not.toBeInTheDocument();
  });
});
