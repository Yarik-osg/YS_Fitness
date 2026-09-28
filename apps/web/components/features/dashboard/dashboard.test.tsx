import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { useAuthStore } from '@/lib/stores/auth-store';
import { I18nTestProvider } from '@/test/i18n';
import { Dashboard } from './dashboard';

function programExercise(
  order: number,
  sets: number,
  allowsAbsAddon: boolean,
  code: string,
  name: string,
  muscleGroups: string[],
  repsMin: number,
  repsMax: number,
) {
  return {
    order,
    sets,
    allowsAbsAddon,
    exercise: {
      id: code,
      code,
      name,
      muscleGroups,
      repsMin,
      repsMax,
    },
  };
}

const ASSIGNED_PROGRAM = {
  id: 'program-1',
  templateCode: 'WB2U',
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  assignedAt: '2026-09-27T00:00:00.000Z',
  days: [
    {
      dayNumber: 1,
      exercises: [
        programExercise(
          1,
          3,
          false,
          'EX_039',
          'Тяга вертикального блоку',
          ['BACK', 'BICEPS'],
          10,
          12,
        ),
        programExercise(
          2,
          3,
          false,
          'EX_008',
          'Жим гантелей вгору сидячи',
          ['SHOULDERS', 'TRICEPS'],
          10,
          12,
        ),
        programExercise(
          3,
          3,
          false,
          'EX_041',
          'Тяга горизонтального блоку',
          ['BACK', 'BICEPS'],
          10,
          12,
        ),
        programExercise(
          4,
          2,
          false,
          'EX_015',
          'Згинання рук з гантелями',
          ['BICEPS'],
          10,
          12,
        ),
        programExercise(
          5,
          3,
          false,
          'EX_037',
          'Сідничний міст у тренажері',
          ['GLUTES'],
          10,
          12,
        ),
        programExercise(
          6,
          3,
          true,
          'EX_033',
          'Румунська тяга з гантелями',
          ['HAMSTRINGS', 'GLUTES'],
          10,
          12,
        ),
      ],
    },
    {
      dayNumber: 2,
      exercises: [
        programExercise(
          1,
          3,
          false,
          'EX_009',
          'Жим гантелей на похилій лавці 30°',
          ['CHEST', 'TRICEPS'],
          10,
          12,
        ),
        programExercise(
          2,
          3,
          false,
          'EX_039',
          'Тяга вертикального блоку',
          ['BACK', 'BICEPS'],
          10,
          12,
        ),
        programExercise(
          3,
          3,
          false,
          'EX_018',
          'Махи гантелями сидячи',
          ['SHOULDERS'],
          12,
          15,
        ),
        programExercise(
          4,
          2,
          false,
          'EX_031',
          'Розгинання рук із канатним руків’ям',
          ['TRICEPS'],
          12,
          15,
        ),
        programExercise(
          5,
          3,
          false,
          'EX_021',
          'Присідання з гирею',
          ['QUADRICEPS', 'GLUTES'],
          10,
          12,
        ),
        programExercise(
          6,
          3,
          false,
          'EX_003',
          'Випади назад з гантелями',
          ['GLUTES', 'QUADRICEPS'],
          10,
          12,
        ),
      ],
    },
  ],
};

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
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function renderDashboard() {
  return render(
    <Providers>
      <I18nTestProvider locale="uk">
        <Dashboard />
      </I18nTestProvider>
    </Providers>,
  );
}

const QUOTES = [
  'Кожне тренування — крок до кращої версії себе.',
  'Результат приходить до тих, хто не зупиняється.',
  'Дисципліна сильніша за мотивацію.',
  'Твоє тіло може все. Переконай свій розум.',
];

describe('Dashboard program', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.getState().clearSession();
  });

  it('shows the assigned home from the program, profile, and subscription', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        if (url.includes('/programs/assign')) {
          expect(init?.method).toBe('POST');
          return json(ASSIGNED_PROGRAM);
        }
        if (url.includes('/programs/me')) {
          return json({ program: null });
        }
        return json({}, 404);
      }),
    );

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
    renderDashboard();

    expect(
      screen.queryByText('Калорії та макроси будуть розраховані окремо.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Виміри, фото й історія результатів — скоро.'),
    ).not.toBeInTheDocument();

    await user.click(
      await screen.findByRole('button', { name: 'Призначити мою програму' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Головна' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('WB2U')).toHaveLength(2);
    expect(screen.getAllByText('Тренування 01')).toHaveLength(2);
    expect(screen.getByText('2 рази', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('2 рази/тиж.')).toBeInTheDocument();
    expect(screen.getByText('6 вправ · 17 підходів')).toBeInTheDocument();
    expect(screen.getByText('Початківець')).toBeInTheDocument();
    expect(screen.getByText('Аліна К.')).toBeInTheDocument();
    expect(
      screen.getByText(`“${QUOTES[new Date().getDay() % QUOTES.length]}”`),
    ).toBeInTheDocument();
    expect(screen.queryByText('Поточний тиждень')).not.toBeInTheDocument();
    expect(screen.queryByText(/Тиждень/)).not.toBeInTheDocument();

    const start = screen.getByRole('button', { name: 'Почати тренування →' });
    expect(start).toBeDisabled();
    expect(start.closest('a')).toBeNull();

    const home = screen.getByRole('button', { name: 'Головна' });
    expect(home).toBeEnabled();
    expect(home).toHaveAttribute('aria-current', 'page');
    for (const name of [
      'Тренування',
      'Харчування',
      'Прогрес',
      'Профіль',
      'Бібліотека',
    ]) {
      const tab = screen.getByRole('button', { name });
      expect(tab).toBeDisabled();
      expect(tab.closest('a')).toBeNull();
    }
  });

  it('does not offer assign while the program is still loading', async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        if (url.includes('/programs/me')) return pending;
        return json({}, 404);
      }),
    );

    renderDashboard();

    expect(
      await screen.findByText('Завантажуємо програму…'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();

    release(json({ program: null }));
    expect(
      await screen.findByRole('button', { name: 'Призначити мою програму' }),
    ).toBeInTheDocument();
  });

  it('shows a load failure without offering to assign', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        if (url.includes('/programs/me')) {
          return json(
            { code: 'INTERNAL_SERVER_ERROR', message: 'failed' },
            500,
          );
        }
        return json({}, 404);
      }),
    );

    renderDashboard();

    expect(
      await screen.findByText('Програму не вдалося завантажити.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Спробувати ще раз' }),
    ).toBeInTheDocument();
  });

  it('shows an assign failure that is not a missing program', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        if (url.includes('/programs/assign')) {
          expect(init?.method).toBe('POST');
          return json(
            { code: 'INTERNAL_SERVER_ERROR', message: 'failed' },
            500,
          );
        }
        if (url.includes('/programs/me')) {
          return json({ program: null });
        }
        return json({}, 404);
      }),
    );

    renderDashboard();
    await user.click(
      await screen.findByRole('button', { name: 'Призначити мою програму' }),
    );

    expect(
      await screen.findByText('Програму не вдалося призначити.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Призначити мою програму' }),
    ).toBeInTheDocument();
  });

  it('shows that no program exists for this track', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        if (url.includes('/programs/assign')) {
          expect(init?.method).toBe('POST');
          return json(
            {
              code: 'PROGRAM_NOT_AVAILABLE',
              message: 'No program is available for this track yet',
            },
            404,
          );
        }
        if (url.includes('/programs/me')) {
          return json({ program: null });
        }
        return json({}, 404);
      }),
    );

    renderDashboard();

    await user.click(
      await screen.findByRole('button', { name: 'Призначити мою програму' }),
    );

    expect(
      await screen.findByText('Для цього напрямку програми ще немає.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Призначити мою програму' }),
      ).not.toBeInTheDocument();
    });
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
