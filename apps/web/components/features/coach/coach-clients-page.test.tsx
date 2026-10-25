import type { ReactNode } from 'react';
import type { CoachClientsResponse } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { CoachClientsPage } from './coach-clients-page';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const roster = vi.hoisted(() => ({
  current: {
    isPending: false,
    isError: false,
    data: undefined as CoachClientsResponse | undefined,
    refetch: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/use-coach-clients', () => ({
  useCoachClients: () => roster.current,
}));

const CLIENTS: CoachClientsResponse = {
  clients: [
    {
      id: 'client-1',
      email: 'olena@example.com',
      name: 'Olena Koval',
      createdAt: '2026-03-04T00:00:00.000Z',
      onboardingCompleted: true,
      programAssigned: true,
      programName: 'Upper split',
      lastWorkoutAt: '2026-04-02T12:00:00.000Z',
      subscriptionOnFile: false,
      subscriptionActive: false,
    },
  ],
};

function workoutDay(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function renderPage(locale: 'uk' | 'en' = 'uk') {
  return render(
    <I18nTestProvider locale={locale}>
      <CoachClientsPage />
    </I18nTestProvider>,
  );
}

describe('CoachClientsPage', () => {
  beforeEach(() => {
    cleanup();
    roster.current = {
      isPending: false,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
  });

  it('shows a loading state', () => {
    roster.current = {
      isPending: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
    renderPage();
    expect(
      screen.getByRole('main').querySelector('[aria-busy="true"]'),
    ).toBeTruthy();
  });

  it('shows an empty roster', () => {
    roster.current = {
      isPending: false,
      isError: false,
      data: { clients: [] },
      refetch: vi.fn(),
    };
    renderPage();
    expect(screen.getByText('Клієнтів ще немає.')).toBeInTheDocument();
    expect(screen.getByText('0 клієнтів')).toBeInTheDocument();
  });

  it('shows clients in Ukrainian and English', () => {
    roster.current = {
      isPending: false,
      isError: false,
      data: CLIENTS,
      refetch: vi.fn(),
    };
    const view = renderPage('uk');
    expect(
      screen.getByRole('heading', { name: 'Клієнти' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Olena Koval' })).toHaveAttribute(
      'href',
      '/coach/clients/client-1',
    );
    expect(screen.getByText('olena@example.com')).toBeInTheDocument();
    expect(screen.getByText('Upper split')).toBeInTheDocument();
    expect(screen.getByText('Підписки немає.')).toBeInTheDocument();
    expect(screen.queryByText('Заповнена')).toBeNull();

    view.rerender(
      <I18nTestProvider locale="en">
        <CoachClientsPage />
      </I18nTestProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Clients' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Upper split')).toBeInTheDocument();
    expect(
      screen.getByText(workoutDay('en', '2026-04-02T12:00:00.000Z')),
    ).toBeInTheDocument();
    expect(screen.getByText('No subscription on file.')).toBeInTheDocument();
    expect(screen.queryByText('Complete')).toBeNull();
  });

  it('shows a client with no program and no workouts', () => {
    roster.current = {
      isPending: false,
      isError: false,
      data: {
        clients: [
          {
            ...CLIENTS.clients[0]!,
            programAssigned: false,
            programName: null,
            lastWorkoutAt: null,
          },
        ],
      },
      refetch: vi.fn(),
    };
    renderPage('en');
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('No workouts')).toBeInTheDocument();
  });

  it('filters by name and email without regard to case', async () => {
    roster.current = {
      isPending: false,
      isError: false,
      data: {
        clients: [
          CLIENTS.clients[0]!,
          {
            ...CLIENTS.clients[0]!,
            id: 'client-2',
            name: 'Ihor',
            email: 'ihor@example.com',
            programName: null,
            lastWorkoutAt: null,
          },
        ],
      },
      refetch: vi.fn(),
    };
    renderPage('en');
    const search = screen.getByRole('searchbox', { name: 'Search clients' });
    await userEvent.type(search, 'OLENA');
    expect(
      screen.getByRole('link', { name: 'Olena Koval' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ihor' })).toBeNull();

    await userEvent.clear(search);
    await userEvent.type(search, 'Ihor@Example');
    expect(screen.getByRole('link', { name: 'Ihor' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Olena Koval' })).toBeNull();

    await userEvent.clear(search);
    await userEvent.type(search, 'nobody');
    expect(
      screen.getByText('No clients match this search.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Olena Koval' })).toBeNull();
  });

  it('shows a lapsed plan as inactive and a current plan as active', () => {
    roster.current = {
      isPending: false,
      isError: false,
      data: {
        clients: [
          {
            ...CLIENTS.clients[0]!,
            id: 'lapsed',
            name: 'Lapsed',
            subscriptionOnFile: true,
            subscriptionActive: false,
          },
          {
            ...CLIENTS.clients[0]!,
            id: 'current',
            name: 'Current',
            subscriptionOnFile: true,
            subscriptionActive: true,
          },
        ],
      },
      refetch: vi.fn(),
    };
    renderPage('en');
    expect(screen.getByRole('link', { name: 'Lapsed' })).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('No subscription on file.')).toBeNull();
  });

  it('shows an error and retries', async () => {
    roster.current = {
      isPending: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    };
    renderPage('en');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Clients could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(roster.current.refetch).toHaveBeenCalledTimes(1);
  });
});
