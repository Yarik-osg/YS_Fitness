import type { CoachClientDetail } from '@repo/shared-types';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { CoachClientPage } from './coach-client-page';

const client = vi.hoisted(() => ({
  current: {
    isPending: false,
    isError: false,
    error: null as Error | null,
    data: undefined as CoachClientDetail | undefined,
    refetch: vi.fn(),
  },
}));

const assign = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const noteSave = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null as Error | null,
}));

const grant = vi.hoisted(() => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
}));

const plans = vi.hoisted(() => ({
  current: {
    isPending: false,
    isError: false,
    data: [
      {
        id: 'plan-1',
        code: '1_MONTH',
        name: 'One month',
        priceAmount: 100,
        currency: 'UAH',
        intervalMonths: 1,
        isActive: true,
      },
    ],
  },
}));

const catalog = vi.hoisted(() => ({
  enabled: true,
}));

vi.mock('@/lib/hooks/use-coach-clients', () => ({
  useCoachClient: () => client.current,
  useAssignCoachProgram: () => assign,
  useUpdateCoachNote: () => noteSave,
  useGrantClientAccess: () => grant,
}));

vi.mock('@/lib/hooks/use-subscriptions', () => ({
  usePlans: () => plans.current,
}));

vi.mock('@/lib/hooks/use-coach-programs', () => ({
  useCoachPrograms: (enabled = true) => {
    catalog.enabled = enabled;
    return {
      isPending: false,
      isError: false,
      data: {
        templates: [
          {
            id: 'template-2',
            code: 'custom-2',
            name: 'Силова на 4 дні',
            gender: 'female',
            level: 'beginner',
            frequencyPerWeek: 4,
            accent: 'NONE',
            origin: 'TRAINER',
            active: true,
            ownerId: 'admin-1',
            dayCount: 4,
            exerciseCount: 8,
            assignedCount: 0,
          },
        ],
      },
    };
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/program-title', () => ({
  useProgramTitle: () => 'Upper-body program',
}));

vi.mock('./coach-client-history', () => ({
  CoachClientHistory: () => null,
}));

const DETAIL: CoachClientDetail = {
  id: 'client-1',
  email: 'olena@example.com',
  name: 'Olena Koval',
  createdAt: '2026-03-04T00:00:00.000Z',
  onboardingCompleted: true,
  archived: false,
  profile: {
    dateOfBirth: '1994-04-12',
    biologicalSexForCalculation: 'FEMALE',
    heightCm: 168.5,
    activityLevel: 'MODERATELY_ACTIVE',
    goal: 'MAINTAIN_WEIGHT',
    timezone: 'Europe/Kyiv',
  },
  onboarding: {
    programTrack: 'female',
    currentBody: '2',
    desiredBody: '3',
    mainGoal: 'maintain',
    experience: 'beginner',
    trainingFrequency: '3',
    focusAreas: [],
    nutritionCurrent: 'balanced',
    mealsPerDay: '3',
    eatingHabits: ['none'],
    physiqueLevel: null,
  },
  program: {
    accent: 'UPPER',
    templateCode: 'WB2U',
    templateName: 'Upper subtitle',
    level: 'beginner',
    frequencyPerWeek: 2,
    gender: 'female',
    origin: 'SYSTEM',
    assignmentSource: 'MATCHED',
    assignedAt: '2026-03-06T00:00:00.000Z',
  },
  subscription: {
    active: false,
    status: 'PENDING',
    planName: 'Progress',
    currentPeriodEnd: '2027-06-01T00:00:00.000Z',
  },
  note: '',
};

function renderPage(locale: 'uk' | 'en' = 'en') {
  return render(
    <I18nTestProvider locale={locale}>
      <CoachClientPage userId="client-1" />
    </I18nTestProvider>,
  );
}

describe('CoachClientPage', () => {
  beforeEach(() => {
    cleanup();
    client.current = {
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      refetch: vi.fn(),
    };
    assign.mutate.mockReset();
    assign.isPending = false;
    noteSave.mutate.mockReset();
    noteSave.isPending = false;
    noteSave.isError = false;
    noteSave.isSuccess = false;
    noteSave.error = null;
    grant.mutate.mockReset();
    grant.reset.mockReset();
    grant.isPending = false;
    grant.isError = false;
    grant.error = null;
    catalog.enabled = true;
  });

  it('shows a loading state', () => {
    client.current.isPending = true;
    renderPage();
    expect(
      screen.getByRole('main').querySelector('[aria-busy="true"]'),
    ).toBeTruthy();
  });

  it('shows saved answers and an inactive subscription', () => {
    client.current.data = DETAIL;
    renderPage('en');
    expect(
      screen.getByRole('heading', { name: 'Olena Koval' }),
    ).toBeInTheDocument();
    expect(screen.getByText('olena@example.com')).toBeInTheDocument();
    expect(screen.getByText('Upper subtitle')).toBeInTheDocument();
    expect(screen.getByText(/System · Matched/)).toBeInTheDocument();
    expect(screen.getByText('Maintain shape')).toBeInTheDocument();
    expect(screen.getByText('Apr 12, 1994')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
    expect(screen.getByText('Option 4')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive')).toHaveLength(2);
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
    expect(screen.queryByText('No subscription on file.')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Back to clients' }),
    ).toHaveAttribute('href', '/coach');
  });

  it('shows a pinned program separately from a matched one', () => {
    client.current.data = {
      ...DETAIL,
      program: DETAIL.program
        ? { ...DETAIL.program, assignmentSource: 'ADMIN', origin: 'TRAINER' }
        : null,
    };
    renderPage('en');
    expect(screen.getByText(/Custom · Pinned/)).toBeInTheDocument();
    expect(screen.queryByText(/Matched/)).toBeNull();
  });

  it('shows empty sections when the client has no saved file', () => {
    client.current.data = {
      ...DETAIL,
      profile: null,
      onboarding: null,
      program: null,
      subscription: null,
    };
    renderPage('en');
    expect(screen.getByText('No profile yet.')).toBeInTheDocument();
    expect(
      screen.getByText('No questionnaire answers yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No program assigned.')).toBeInTheDocument();
    expect(screen.getAllByText('No subscription on file.')).toHaveLength(2);
    expect(screen.queryByText('Inactive')).toBeNull();
  });

  it('shows a lapsed plan as ended and a current plan as active', () => {
    client.current.data = {
      ...DETAIL,
      subscription: {
        active: false,
        status: 'ACTIVE',
        planName: 'Progress',
        currentPeriodEnd: '2020-01-01T00:00:00.000Z',
      },
    };
    const view = renderPage('en');
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.queryByText('No subscription on file.')).toBeNull();

    client.current.data = {
      ...DETAIL,
      subscription: {
        active: true,
        status: 'ACTIVE',
        planName: 'Progress',
        currentPeriodEnd: '2099-01-01T00:00:00.000Z',
      },
    };
    view.rerender(
      <I18nTestProvider locale="en">
        <CoachClientPage userId="client-1" />
      </I18nTestProvider>,
    );
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.queryByText('Expired')).toBeNull();
    expect(screen.queryByText('No subscription on file.')).toBeNull();
  });

  it('shows not found without a retry', () => {
    client.current.isError = true;
    client.current.error = new ApiClientError(
      404,
      'CLIENT_NOT_FOUND',
      'missing',
    );
    renderPage('en');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This client could not be found.',
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('retries a failed load', async () => {
    client.current.isError = true;
    client.current.error = new ApiClientError(500, 'SERVER_ERROR', 'down');
    renderPage('en');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(client.current.refetch).toHaveBeenCalledTimes(1);
  });

  it('asks before replacing the assigned program', async () => {
    client.current.data = DETAIL;
    renderPage('en');
    await userEvent.click(
      screen.getByRole('button', { name: 'Replace program' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Силова на 4 дні/ }),
    );
    expect(assign.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText('Replace the current program with Силова на 4 дні?'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Replace program' })[1]!,
    );
    expect(assign.mutate).toHaveBeenCalledWith(
      'template-2',
      expect.any(Object),
    );
  });

  it('loads the catalog only while the picker is open', async () => {
    client.current.data = DETAIL;
    renderPage('en');
    expect(catalog.enabled).toBe(false);
    await userEvent.click(
      screen.getByRole('button', { name: 'Replace program' }),
    );
    expect(catalog.enabled).toBe(true);
    expect(
      screen.getByRole('searchbox', { name: 'Search programs' }),
    ).toBeInTheDocument();
  });

  it('closes the picker without assigning', async () => {
    client.current.data = DETAIL;
    renderPage('en');
    await userEvent.click(
      screen.getByRole('button', { name: 'Replace program' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      screen.queryByRole('searchbox', { name: 'Search programs' }),
    ).toBeNull();
    expect(assign.mutate).not.toHaveBeenCalled();
    expect(catalog.enabled).toBe(false);
  });

  it('keeps the picker open and names a missing client', async () => {
    client.current.data = DETAIL;
    assign.mutate.mockImplementation((_templateId, options) => {
      options.onError(
        new ApiClientError(404, 'CLIENT_NOT_FOUND', 'Client not found.'),
      );
    });
    renderPage('en');
    await userEvent.click(
      screen.getByRole('button', { name: 'Replace program' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Силова на 4 дні/ }),
    );
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Replace program' })[1]!,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This client could not be found.',
    );
    expect(
      screen.getByRole('searchbox', { name: 'Search programs' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('This program could not be found.')).toBeNull();
  });

  it('shows a template conflict and a validation message', async () => {
    client.current.data = DETAIL;
    assign.mutate.mockImplementation((_templateId, options) => {
      options.onError(
        new ApiClientError(
          409,
          'TEMPLATE_INACTIVE',
          'This program is not available to assign',
        ),
      );
    });
    renderPage('en');
    await userEvent.click(
      screen.getByRole('button', { name: 'Replace program' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Силова на 4 дні/ }),
    );
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Replace program' })[1]!,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This program is not available to assign.',
    );

    assign.mutate.mockImplementation((_templateId, options) => {
      options.onError(
        new ApiClientError(
          400,
          'VALIDATION_ERROR',
          'templateId must be a UUID',
        ),
      );
    });
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Replace program' })[1]!,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'templateId must be a UUID',
    );
    expect(
      screen.getByRole('searchbox', { name: 'Search programs' }),
    ).toBeInTheDocument();
  });

  it('saves a private note and shows a failure', async () => {
    client.current.data = { ...DETAIL, subscription: null, note: '' };
    renderPage();
    const field = screen.getByRole('textbox', { name: 'Private note' });
    expect(field).toHaveValue('');
    await userEvent.type(field, 'Knee');
    await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(noteSave.mutate).toHaveBeenCalledWith(
      { note: 'Knee', base: '' },
      expect.any(Object),
    );

    cleanup();
    noteSave.isError = true;
    noteSave.error = new ApiClientError(500, 'NOTE_FAILED', 'failed');
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The note could not be saved.',
    );
  });

  it('asks before granting access and reports a conflict', async () => {
    client.current.data = { ...DETAIL, subscription: null };
    grant.mutate.mockImplementation((_planId, options) => {
      options.onSuccess();
    });
    renderPage();
    expect(
      screen.queryByText('A checkout is still open, so a grant waits.'),
    ).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Grant access' }));
    expect(screen.getByText(/does not take a payment/i)).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Grant access',
      }),
    );
    expect(grant.mutate).toHaveBeenCalledWith('plan-1', expect.any(Object));

    cleanup();
    grant.isError = true;
    grant.error = new ApiClientError(409, 'SUBSCRIPTION_ALREADY_ACTIVE', 'no');
    grant.mutate.mockReset();
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Grant access' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This client already has access or an open checkout.',
    );
  });

  it('waits while a checkout is open', () => {
    client.current.data = DETAIL;
    renderPage();
    expect(
      screen.getByText('A checkout is still open, so a grant waits.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant access' })).toBeNull();
  });
});
