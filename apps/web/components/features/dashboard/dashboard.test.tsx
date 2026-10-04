import type {
  AssignedProgramResponse,
  MuscleGroup,
  ProgramExerciseResponse,
  TrainingExperience,
} from '@repo/shared-types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { useAuthStore } from '@/lib/stores/auth-store';
import { I18nTestProvider } from '@/test/i18n';
import { Dashboard } from './dashboard';

const routerReplace = vi.hoisted(() => vi.fn());
const MONDAY = new Date(2026, 8, 28, 12, 0, 0);

function programExercise(
  order: number,
  sets: number,
  allowsAbsAddon: boolean,
  code: string,
  name: string,
  muscleGroups: MuscleGroup[],
  repsMin: number,
  repsMax: number,
): ProgramExerciseResponse {
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

const TEMPLATE_NAME =
  'WB2U — Жінки · Початковий рівень · 2 тренування на тиждень · Акцент на верх';

const ASSIGNED_PROGRAM = {
  id: 'program-1',
  templateId: '11111111-1111-4111-8111-111111111111',
  templateCode: 'WB2U',
  templateName: TEMPLATE_NAME,
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  assignedAt: '2026-09-27T00:00:00.000Z',
  nextDayNumber: 2,
  programProgress: { completed: 9, expected: 16 },
  dayLogCounts: [],
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
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function renderDashboard(locale: 'uk' | 'en' = 'uk') {
  return render(
    <Providers>
      <I18nTestProvider locale={locale}>
        <Dashboard />
      </I18nTestProvider>
    </Providers>,
  );
}

function signInAsAlina() {
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

function expectNoPlaceholderCards() {
  expect(
    screen.queryByText('Калорії та макроси будуть розраховані окремо.'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Виміри, фото й історія результатів — скоро.'),
  ).not.toBeInTheDocument();
}

function expectHomeCards() {
  expect(screen.getAllByText(TEMPLATE_NAME)).toHaveLength(2);
  expect(screen.getAllByText('Тренування 02')).toHaveLength(2);
  expect(screen.getByText('2 рази', { exact: true })).toBeInTheDocument();
  expect(screen.getByText('9 / 16')).toBeInTheDocument();
  expect(screen.getByText('2 рази/тиж.')).toBeInTheDocument();
  expect(screen.getByText('6 вправ · 17 підходів')).toBeInTheDocument();
  expect(screen.getByText('Початківець')).toBeInTheDocument();
  expect(screen.getByText('Аліна К.')).toBeInTheDocument();
}

describe('Dashboard program', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useAuthStore.getState().clearSession();
    routerReplace.mockClear();
  });

  it('assigns a program and shows the home cards', async () => {
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

    signInAsAlina();
    renderDashboard();

    expect(
      await screen.findByRole('button', { name: 'Призначити мою програму' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Профіль' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expectNoPlaceholderCards();

    await user.click(
      screen.getByRole('button', { name: 'Призначити мою програму' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Головна' }),
    ).toBeInTheDocument();
    expectHomeCards();
    expectNoPlaceholderCards();
    expect(screen.queryByText('Поточний тиждень')).not.toBeInTheDocument();
    expect(screen.queryByText(/Тиждень/)).not.toBeInTheDocument();

    const start = screen.getByRole('link', { name: 'Почати тренування →' });
    expect(start).toHaveAttribute('href', '/workout');

    const profileCard = screen.getByRole('link', { name: /Аліна/ });
    expect(profileCard).toHaveAttribute('href', '/profile');
    expect(
      screen.getByRole('link', { name: /6 вправ · 17 підходів/ }),
    ).toHaveAttribute('href', '/training');

    const home = screen.getByRole('link', { name: 'Головна' });
    expect(home).toHaveAttribute('href', '/dashboard');
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Профіль' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.getByRole('link', { name: 'Тренування' })).toHaveAttribute(
      'href',
      '/training',
    );
    for (const name of ['Харчування', 'Прогрес', 'Бібліотека']) {
      const tab = screen.getByRole('button', { name });
      expect(tab).toBeDisabled();
      expect(tab.closest('a')).toBeNull();
    }
  });

  it('shows the home for a returning member without assigning again', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/me')) {
          return json({ program: ASSIGNED_PROGRAM });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Головна' }),
    ).toBeInTheDocument();
    expectHomeCards();
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();
  });

  it('shows a neutral loader while the program is still loading', async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/me')) return pending;
        return json({}, 404);
      }),
    );

    renderDashboard();

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Особистий кабінет')).not.toBeInTheDocument();
    expect(screen.queryByText('Твоя система')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Завантажуємо програму…'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Головна' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('WB2U')).not.toBeInTheDocument();

    release(json({ program: ASSIGNED_PROGRAM }));
    expect(
      await screen.findByRole('heading', { name: 'Головна' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('shows Monday’s date and quote in Ukrainian and English', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/me')) {
          return json({ program: ASSIGNED_PROGRAM });
        }
        return json({}, 404);
      }),
    );

    renderDashboard('uk');
    expect(
      await screen.findByText('понеділок, 28 вересня'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('“Результат приходить до тих, хто не зупиняється.”'),
    ).toBeInTheDocument();

    cleanup();
    renderDashboard('en');
    expect(await screen.findByText('Monday, September 28')).toBeInTheDocument();
    expect(
      screen.getByText('“Results come to those who do not stop.”'),
    ).toBeInTheDocument();
  });

  it('shows the Ukrainian label for every template level', async () => {
    const labels: Record<TrainingExperience, string> = {
      beginner: 'Початківець',
      intermediate: 'Середній рівень',
      advanced: 'Просунутий',
    };

    for (const level of Object.keys(labels) as TrainingExperience[]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('/programs/me')) {
            return json({ program: { ...ASSIGNED_PROGRAM, level } });
          }
          return json({}, 404);
        }),
      );
      renderDashboard();
      expect(await screen.findByText(labels[level])).toBeInTheDocument();
      cleanup();
    }
  });

  it('logs out from the home header and returns to login', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/auth/logout')) {
          expect(init?.method).toBe('POST');
          return new Response(null, { status: 204 });
        }
        if (url.includes('/programs/me')) {
          return json({ program: ASSIGNED_PROGRAM });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'Вийти' }));

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith('/login');
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a load failure without offering to assign', async () => {
    const user = userEvent.setup();
    let programRequests = 0;
    let releaseExtra: (response: Response) => void = () => undefined;
    const extra = new Promise<Response>((resolve) => {
      releaseExtra = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        if (url.includes('/programs/me')) {
          programRequests += 1;
          if (programRequests === 1) {
            return json(
              { code: 'INTERNAL_SERVER_ERROR', message: 'failed' },
              500,
            );
          }
          return extra;
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

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(programRequests).toBe(1);
    expect(
      screen.getByText('Програму не вдалося завантажити.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Спробувати ще раз' }),
      ).toBeDisabled();
    });
    expect(programRequests).toBe(2);
    expect(
      screen.getByText('Програму не вдалося завантажити.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();

    releaseExtra(
      json({ code: 'INTERNAL_SERVER_ERROR', message: 'failed' }, 500),
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Спробувати ще раз' }),
      ).toBeEnabled();
    });
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();
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
