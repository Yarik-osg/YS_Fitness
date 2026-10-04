import type { AssignedProgramResponse } from '@repo/shared-types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/components/providers';
import { I18nTestProvider } from '@/test/i18n';
import { ageYears, ProfilePage } from './profile-page';

const routerReplace = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());

const TEMPLATE_NAME =
  'WB2U — Жінки · Початковий рівень · 2 тренування на тиждень · Акцент на верх';
const NEXT_TEMPLATE_NAME =
  'WM4 — Жінки · Середній рівень · 4 тренування на тиждень · Без акценту';

const PROGRAM = {
  id: 'program-1',
  templateId: '11111111-1111-4111-8111-111111111111',
  templateCode: 'WB2U',
  templateName: TEMPLATE_NAME,
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  assignedAt: '2026-09-27T00:00:00.000Z',
  nextDayNumber: 1,
  programProgress: { completed: 9, expected: 16 },
  dayLogCounts: [],
  days: [],
} satisfies AssignedProgramResponse;

const ME = {
  id: 'user-1',
  email: 'alina@example.com',
  role: 'CLIENT',
  isActive: true,
  createdAt: '2026-01-15T12:00:00.000Z',
  profile: {
    name: 'Аліна К.',
    dateOfBirth: '1998-04-12',
    biologicalSexForCalculation: 'FEMALE',
    heightCm: 168,
    activityLevel: 'MODERATELY_ACTIVE',
    goal: 'LOSE_WEIGHT',
    healthRestrictions: null,
    timezone: 'Europe/Kyiv',
    onboardingCompletedAt: '2026-09-01T00:00:00.000Z',
  },
  bodyMeasurements: [
    {
      id: 'measure-1',
      weightKg: '58',
      bodyFatPercent: '22',
      measuredAt: '2026-09-01T00:00:00.000Z',
    },
  ],
};

const RESPONSES = {
  responses: {
    programTrack: 'female',
    currentBody: '0',
    desiredBody: '1',
    mainGoal: 'lose_weight',
    experience: 'beginner',
    trainingFrequency: '2',
    focusAreas: ['glutes'],
    nutritionCurrent: 'balanced',
    mealsPerDay: '3',
    eatingHabits: ['snacking'],
    physiqueLevel: '4',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
};

const SUBSCRIPTION = {
  subscription: {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'plan-1',
    status: 'ACTIVE',
    provider: 'MOCK',
    providerReference: 'mock_sub',
    currentPeriodEnd: '2026-12-01T00:00:00.000Z',
    grantedByUserId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    plan: {
      id: 'plan-1',
      code: '1_MONTH',
      name: '1 місяць',
      priceAmount: 99_000,
      currency: 'UAH',
      intervalMonths: 1,
      isActive: true,
    },
  },
};

const PLANS = [SUBSCRIPTION.subscription.plan];

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
  usePathname: () => '/profile',
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function renderProfile() {
  return render(
    <Providers>
      <I18nTestProvider locale="uk">
        <ProfilePage />
      </I18nTestProvider>
    </Providers>,
  );
}

describe('Profile page', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    routerReplace.mockClear();
    routerPush.mockClear();
  });

  it('renders the member, program, and subscription from the profile endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => jsonFor(String(input))),
    );

    renderProfile();

    expect(
      await screen.findByRole('heading', { name: 'Профіль' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Аліна К.')).toBeInTheDocument();
    expect(screen.getByText('alina@example.com')).toBeInTheDocument();
    expect(
      screen.getByText(
        `Учень з ${formatMonthYear('2026-01-15T12:00:00.000Z')}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Жіноча')).toBeInTheDocument();
    expect(screen.getByText(ageLabel('1998-04-12'))).toBeInTheDocument();
    expect(screen.getByText('168 см')).toBeInTheDocument();
    expect(screen.getByText('58 кг')).toBeInTheDocument();
    expect(screen.getAllByText('Початківець').length).toBeGreaterThan(0);
    expect(screen.getByText('Схуднути')).toBeInTheDocument();
    expect(screen.getByText('2 рази')).toBeInTheDocument();
    expect(screen.getByText(TEMPLATE_NAME)).toBeInTheDocument();
    expect(screen.getByText('9 / 16')).toBeInTheDocument();
    expect(screen.getByText('1 місяць')).toBeInTheDocument();
    expect(
      screen.getByText(formatDay('2026-12-01T00:00:00.000Z')),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Активна').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Профіль' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.getByRole('link', { name: 'Головна' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: 'Тренування' })).toHaveAttribute(
      'href',
      '/training',
    );
    expect(
      screen.queryByRole('button', { name: /оновити мої дані/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the profile when no program is assigned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/assigned')) return json({ program: null });
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        return jsonFor(url);
      }),
    );

    renderProfile();

    expect(
      await screen.findByRole('heading', { name: 'Профіль' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Аліна К.')).toBeInTheDocument();
    expect(screen.getByText('Програму ще не призначено.')).toBeInTheDocument();
    expect(screen.getByText('Підписка ще не активована.')).toBeInTheDocument();
    expect(screen.queryByText(TEMPLATE_NAME)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the profile when onboarding answers and program are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/onboarding-responses')) {
          return json({ responses: null });
        }
        if (url.includes('/programs/assigned')) return json({ program: null });
        return jsonFor(url);
      }),
    );

    renderProfile();

    expect(
      await screen.findByRole('heading', { name: 'Профіль' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Аліна К.')).toBeInTheDocument();
    expect(screen.getByText('Жіноча')).toBeInTheDocument();
    expect(screen.getByText('168 см')).toBeInTheDocument();
    expect(screen.getByText('Програму ще не призначено.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Редагувати' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lets a member without answers edit height and training fields', async () => {
    const user = userEvent.setup();
    let answers: { responses: typeof RESPONSES.responses | null } = {
      responses: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/onboarding-responses')) {
          return json(answers);
        }
        if (url.includes('/programs/assigned')) return json({ program: null });
        if (url.includes('/users/me/profile')) {
          expect(init?.method).toBe('PATCH');
          expect(JSON.parse(String(init?.body))).toEqual({
            heightCm: 170,
            weightKg: 58,
            experience: 'beginner',
            mainGoal: 'lose_weight',
            trainingFrequency: '2',
          });
          answers = {
            responses: {
              ...RESPONSES.responses,
              experience: 'beginner',
              mainGoal: 'lose_weight',
              trainingFrequency: '2',
              focusAreas: [],
              currentBody: '',
              desiredBody: '',
              mealsPerDay: '',
              eatingHabits: [],
            },
          };
          return json({
            heightCm: 170,
            weightKg: 58,
            experience: 'beginner',
            mainGoal: 'lose_weight',
            trainingFrequency: '2',
            program: null,
          });
        }
        return jsonFor(url);
      }),
    );

    renderProfile();
    await screen.findByRole('heading', { name: 'Профіль' });
    await user.click(screen.getByRole('button', { name: 'Редагувати' }));
    const height = screen.getByRole('spinbutton', { name: /Зріст/ });
    await user.clear(height);
    await user.type(height, '170');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('170 см')).toBeInTheDocument();
    expect(await screen.findByText('Початківець')).toBeInTheDocument();
  });

  it('keeps section errors from looking like empty data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/onboarding-responses')) {
          return json({ message: 'fail' }, 500);
        }
        if (url.includes('/programs/assigned')) {
          return json({ message: 'fail' }, 500);
        }
        if (url.includes('/subscriptions/me')) {
          return json({ message: 'fail' }, 500);
        }
        return jsonFor(url);
      }),
    );

    renderProfile();

    expect(
      await screen.findByRole('heading', { name: 'Профіль' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Не вдалося завантажити дані.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Не вдалося завантажити програму.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Не вдалося завантажити підписку.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Редагувати' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Програму ще не призначено.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Підписка ще не активована.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Продовжити' }),
    ).not.toBeInTheDocument();
  });

  it('saves height and weight only after answers fail to load', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/onboarding-responses')) {
          return json({ message: 'fail' }, 500);
        }
        if (url.includes('/users/me/profile')) {
          expect(init?.method).toBe('PATCH');
          expect(JSON.parse(String(init?.body))).toEqual({
            heightCm: 170,
            weightKg: 58,
          });
          return json({
            heightCm: 170,
            weightKg: 58,
            experience: null,
            mainGoal: null,
            trainingFrequency: null,
            program: PROGRAM,
          });
        }
        return jsonFor(url);
      }),
    );

    renderProfile();
    await screen.findByRole('heading', { name: 'Профіль' });
    await user.click(screen.getByRole('button', { name: 'Редагувати' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const height = screen.getByRole('spinbutton', { name: /Зріст/ });
    await user.clear(height);
    await user.type(height, '170');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('170 см')).toBeInTheDocument();
  });

  it('hides program details without an active subscription', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/me')) {
          return json({ subscription: null });
        }
        return jsonFor(url);
      }),
    );

    renderProfile();

    expect(
      await screen.findByText('Програму ще не призначено.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(TEMPLATE_NAME)).not.toBeInTheDocument();
    expect(screen.queryByText('Активна')).not.toBeInTheDocument();
  });

  it('treats a missing assigned-program endpoint as no program', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/programs/assigned')) {
          return json(
            {
              statusCode: 403,
              code: 'SUBSCRIPTION_REQUIRED',
              message: 'An active subscription is required',
            },
            403,
          );
        }
        return jsonFor(url);
      }),
    );

    renderProfile();

    expect(
      await screen.findByRole('heading', { name: 'Профіль' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Програму ще не призначено.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('saves an edit and shows the reassigned program', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/users/me/profile')) {
          expect(init?.method).toBe('PATCH');
          expect(JSON.parse(String(init?.body))).toEqual({
            heightCm: 170,
            weightKg: 58,
            experience: 'intermediate',
            mainGoal: 'build_muscle',
            trainingFrequency: '4',
          });
          return json({
            heightCm: 170,
            weightKg: 58,
            experience: 'intermediate',
            mainGoal: 'build_muscle',
            trainingFrequency: '4',
            program: {
              ...PROGRAM,
              templateCode: 'WM4',
              templateName: NEXT_TEMPLATE_NAME,
              level: 'intermediate',
              frequencyPerWeek: 4,
            },
          });
        }
        return jsonFor(url);
      }),
    );

    renderProfile();
    await screen.findByRole('heading', { name: 'Профіль' });
    await user.click(screen.getByRole('button', { name: 'Редагувати' }));

    expect(
      screen.queryByRole('spinbutton', { name: /Вік/ }),
    ).not.toBeInTheDocument();
    const height = screen.getByRole('spinbutton', { name: /Зріст/ });
    await user.clear(height);
    await user.type(height, '170');
    await selectLabeledOption(user, 'Рівень підготовки', 'Середній рівень');
    await selectLabeledOption(user, 'Основна ціль', "Набрати м'язову масу");
    await selectLabeledOption(user, 'Тренувань на тиждень', '4 рази');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText(NEXT_TEMPLATE_NAME)).toBeInTheDocument();
    expect(screen.getByText('170 см')).toBeInTheDocument();
    expect(screen.getAllByText('Середній рівень').length).toBeGreaterThan(0);
    expect(screen.getByText("Набрати м'язову масу")).toBeInTheDocument();
    expect(screen.getByText('4 рази')).toBeInTheDocument();
  });

  it('keeps unfinished settings rows from navigating', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => jsonFor(String(input))),
    );

    renderProfile();
    await screen.findByRole('heading', { name: 'Профіль' });

    expect(screen.getByRole('button', { name: 'Змінити мову' })).toBeEnabled();

    for (const name of [
      'Сповіщення',
      'Підтримка',
      'Політика конфіденційності',
      'Умови використання',
    ]) {
      const row = screen.getByRole('button', { name });
      expect(row).toBeDisabled();
      expect(row.closest('a')).toBeNull();
    }

    expect(routerPush).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('renews through the plan list', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/subscriptions/plans')) return json(PLANS);
        if (url.includes('/subscriptions/renew')) {
          expect(init?.method).toBe('POST');
          expect(JSON.parse(String(init?.body))).toEqual({ planId: 'plan-1' });
          return json({
            checkoutUrl: null,
            subscription: {
              ...SUBSCRIPTION.subscription,
              currentPeriodEnd: '2027-01-01T00:00:00.000Z',
            },
          });
        }
        return jsonFor(url);
      }),
    );

    renderProfile();
    await screen.findByRole('heading', { name: 'Профіль' });
    await user.click(screen.getByRole('button', { name: 'Продовжити' }));
    await user.click(await screen.findByRole('button', { name: /1 місяць/ }));
    await user.click(screen.getByRole('button', { name: 'Підтвердити' }));

    expect(
      await screen.findByText(formatDay('2027-01-01T00:00:00.000Z')),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/subscriptions/renew'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('sends the member to the delayed-provider checkout url', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/subscriptions/plans')) return json(PLANS);
        if (url.includes('/subscriptions/renew')) {
          return json({
            checkoutUrl: 'https://pay.example/renew',
            subscription: SUBSCRIPTION.subscription,
          });
        }
        return jsonFor(url);
      }),
    );

    renderProfile();
    await screen.findByRole('heading', { name: 'Профіль' });
    await user.click(screen.getByRole('button', { name: 'Продовжити' }));
    await user.click(await screen.findByRole('button', { name: /1 місяць/ }));
    await user.click(screen.getByRole('button', { name: 'Підтвердити' }));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://pay.example/renew');
    });
  });
});

function routeBody(url = '') {
  if (url.includes('/onboarding-responses')) return RESPONSES;
  if (url.includes('/programs/assigned')) return { program: PROGRAM };
  if (url.includes('/subscriptions/me')) return SUBSCRIPTION;
  if (url.includes('/users/me')) return ME;
  return ME;
}

function jsonFor(url: string) {
  if (url.includes('/programs/me')) {
    return json(
      {
        statusCode: 403,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required',
      },
      403,
    );
  }
  return json(routeBody(url));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function selectLabeledOption(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}

function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat('uk', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('uk', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

describe('ageYears', () => {
  it('compares the birth calendar date to local today', () => {
    expect(ageYears('1998-04-12', new Date(1999, 3, 12, 1, 0, 0))).toBe(1);
    expect(ageYears('1998-04-12', new Date(1999, 3, 11, 23, 0, 0))).toBe(0);
  });
});

function ageLabel(dateOfBirth: string) {
  const age = ageYears(dateOfBirth);
  const word =
    age % 10 === 1 && age % 100 !== 11
      ? 'рік'
      : age % 10 >= 2 && age % 10 <= 4 && (age % 100 < 12 || age % 100 > 14)
        ? 'роки'
        : 'років';
  return `${age} ${word}`;
}
