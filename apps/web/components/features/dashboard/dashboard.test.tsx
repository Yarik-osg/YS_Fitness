import type {
  AssignedProgramResponse,
  MuscleGroup,
  ProgramExerciseResponse,
  TrainingExperience,
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
      nameEn: name,
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

    expect(await screen.findByText('Програму призначено.')).toBeInTheDocument();
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
    expect(
      screen.getByRole('link', { name: /9 \/ 16 тренувань/ }),
    ).toHaveAttribute('href', '/progress');
    for (const name of ['Харчування', 'Бібліотека']) {
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

  it('shows the later equal-timestamp weight and the change from the first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/me')) {
          return json({ program: ASSIGNED_PROGRAM });
        }
        if (url.includes('/users/me/measurements')) {
          return json({
            measurements: [
              {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                weightKg: 70,
                measuredAt: '2026-09-28T12:00:00.000Z',
              },
              {
                id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                weightKg: 80,
                measuredAt: '2026-09-28T12:00:00.000Z',
              },
            ],
            firstMeasurement: {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              weightKg: 60,
              measuredAt: '2026-08-01T12:00:00.000Z',
            },
          });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    expect(await screen.findByText('80,0 кг')).toBeInTheDocument();
    expect(screen.getByText('+20,0 кг від старту')).toBeInTheDocument();
    expect(screen.queryByText('70,0 кг')).not.toBeInTheDocument();
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
      screen.getByText('Признач програму за відповідями квізу.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Призначити мою програму' }),
    ).toBeInTheDocument();
  });

  it('links to checkout when the program needs a subscription', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        if (url.includes('/programs/me')) {
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

    renderDashboard();

    expect(
      await screen.findByRole('link', { name: 'Обрати план' }),
    ).toHaveAttribute('href', '/checkout');
    expect(
      screen.queryByRole('button', { name: 'Призначити мою програму' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Спробувати ще раз' }),
    ).not.toBeInTheDocument();
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

  it('keeps the promotion sheet closed before the session target', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/programs/me')) {
        return json({
          program: {
            ...ASSIGNED_PROGRAM,
            programProgress: { completed: 31, expected: 32 },
          },
        });
      }
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    signInAsAlina();
    renderDashboard();

    expect(await screen.findByText('31 / 32')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/programs/promotion'),
      ),
    ).toBe(false);
  });

  it('names the program for each new focus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/promotion')) {
          return json({
            kind: 'zone-change',
            fromLevel: 'advanced',
            toLevel: 'advanced',
            suggestions: [
              {
                id: NEXT_TEMPLATE_ID,
                code: 'MP2B',
                name: 'MP2B advanced back',
                accent: 'BACK',
                level: 'advanced',
                frequencyPerWeek: 2,
              },
            ],
          });
        }
        if (url.includes('/programs/me')) {
          return json({ program: finishedProgram() });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    const dialog = await screen.findByRole('dialog', {
      name: 'Обери новий акцент',
    });
    expect(within(dialog).getByText('Спина')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', {
        name: 'Програма з акцентом на спину',
      }),
    ).toBeEnabled();
  });

  it('shows an error when the next program cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/promotion')) return json({}, 500);
        if (url.includes('/programs/me')) {
          return json({ program: finishedProgram() });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    expect(await screen.findByText('32 / 32')).toBeInTheDocument();
    expect(
      await screen.findByText('Наступну програму не вдалося завантажити.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the next program at the session target', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/programs/promotion') && init?.method === 'POST') {
          return json(ASSIGNED_PROGRAM);
        }
        if (url.includes('/programs/promotion')) {
          return json(LEVEL_UP);
        }
        if (url.includes('/programs/me')) {
          return json({ program: finishedProgram() });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    expect(await screen.findByText('32 / 32')).toBeInTheDocument();
    expect(
      await screen.findByRole('dialog', { name: 'Наступний рівень' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Призначити' })).toBeEnabled();
  });

  it('shows no confirm action when no next program exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/promotion')) {
          return json({ ...LEVEL_UP, suggestions: [] });
        }
        if (url.includes('/programs/me')) {
          return json({ program: finishedProgram() });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    const dialog = await screen.findByRole('dialog', {
      name: 'Наступної програми немає',
    });
    expect(
      within(dialog).queryByRole('button', { name: 'Призначити' }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Залишити' }),
    ).toBeInTheDocument();
  });

  it('closes the promotion sheet without accepting', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/programs/promotion') && init?.method === 'POST') {
          return json(LEVEL_UP);
        }
        if (url.includes('/programs/promotion')) return json(LEVEL_UP);
        if (url.includes('/programs/me')) {
          return json({ program: finishedProgram() });
        }
        return json({}, 404);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    signInAsAlina();
    renderDashboard();

    await user.click(
      within(
        await screen.findByRole('dialog', { name: 'Наступний рівень' }),
      ).getByRole('button', { name: 'Залишити' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).includes('/programs/promotion') &&
          (init as RequestInit | undefined)?.method === 'POST',
      ),
    ).toBe(false);
  });

  it('disables confirm while the next program is being saved', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/programs/promotion') && init?.method === 'POST') {
          return pending;
        }
        if (url.includes('/programs/promotion')) return json(LEVEL_UP);
        if (url.includes('/programs/me')) {
          return json({ program: finishedProgram() });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    const dialog = await screen.findByRole('dialog', {
      name: 'Наступний рівень',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Призначити' }),
    );

    expect(
      within(dialog).getByRole('button', { name: 'Призначити' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Залишити' }),
    ).toBeDisabled();

    release(
      json({
        ...finishedProgram(),
        level: 'intermediate',
        programProgress: { completed: 0, expected: 32 },
      }),
    );
    expect(await screen.findByText('Програму призначено.')).toBeInTheDocument();
  });

  it('refreshes and shows the assignment error when the offer is rejected', async () => {
    const user = userEvent.setup();
    let promotionReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/programs/promotion') && init?.method === 'POST') {
          return json(
            {
              code: 'PROMOTION_NOT_AVAILABLE',
              message: 'This program is no longer available to start',
            },
            400,
          );
        }
        if (url.includes('/programs/promotion')) {
          promotionReads += 1;
          return json(promotionReads === 1 ? LEVEL_UP : null);
        }
        if (url.includes('/programs/me')) {
          return json({ program: finishedProgram() });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    await user.click(
      within(
        await screen.findByRole('dialog', { name: 'Наступний рівень' }),
      ).getByRole('button', { name: 'Призначити' }),
    );

    expect(
      await screen.findByText('Програму не вдалося призначити.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Програму призначено.')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(promotionReads).toBeGreaterThan(1);
  });

  it('closes a stale offer once the new block is under the target', async () => {
    const user = userEvent.setup();
    let programReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/programs/promotion') && init?.method === 'POST') {
          return json(
            {
              code: 'PROMOTION_NOT_AVAILABLE',
              message: 'This program is no longer available to start',
            },
            400,
          );
        }
        if (url.includes('/programs/promotion')) return json(LEVEL_UP);
        if (url.includes('/programs/me')) {
          programReads += 1;
          return json({
            program:
              programReads === 1
                ? finishedProgram()
                : {
                    ...finishedProgram(),
                    level: 'intermediate',
                    programProgress: { completed: 0, expected: 32 },
                  },
          });
        }
        return json({}, 404);
      }),
    );

    signInAsAlina();
    renderDashboard();

    await user.click(
      within(
        await screen.findByRole('dialog', { name: 'Наступний рівень' }),
      ).getByRole('button', { name: 'Призначити' }),
    );

    expect(
      await screen.findByText('Програму не вдалося призначити.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('0 / 32')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: 'Призначити' }),
    ).not.toBeInTheDocument();
  });
});

const NEXT_TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';

const LEVEL_UP = {
  kind: 'level-up' as const,
  fromLevel: 'beginner' as const,
  toLevel: 'intermediate' as const,
  suggestions: [
    {
      id: NEXT_TEMPLATE_ID,
      code: 'WM2U',
      name: 'WM2U intermediate upper',
      accent: 'UPPER' as const,
      level: 'intermediate' as const,
      frequencyPerWeek: 2,
    },
  ],
};

function finishedProgram() {
  return {
    ...ASSIGNED_PROGRAM,
    programProgress: { completed: 32, expected: 32 },
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
