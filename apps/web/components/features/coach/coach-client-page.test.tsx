import type { CoachClientDetail } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
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

vi.mock('@/lib/hooks/use-coach-clients', () => ({
  useCoachClient: () => client.current,
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
    assignedAt: '2026-03-06T00:00:00.000Z',
  },
  subscription: {
    active: false,
    status: 'PENDING',
    planName: 'Progress',
    currentPeriodEnd: '2027-06-01T00:00:00.000Z',
  },
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
    expect(screen.getByText('Upper-body program')).toBeInTheDocument();
    expect(screen.getByText('Maintain shape')).toBeInTheDocument();
    expect(screen.getByText('Apr 12, 1994')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
    expect(screen.getByText('Option 4')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to clients' }),
    ).toHaveAttribute('href', '/coach');
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
    expect(screen.getByText('No subscription on file.')).toBeInTheDocument();
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
});
