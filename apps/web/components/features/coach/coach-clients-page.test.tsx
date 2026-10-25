import type { ReactNode } from 'react';
import type { CoachClientsResponse } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import {
  CoachClientsPage,
  missedRecentWorkout,
  QUIET_WINDOW_MS,
} from './coach-clients-page';

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

const archive = vi.hoisted(() => ({
  current: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    reset: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/use-coach-clients', () => ({
  useCoachClients: () => roster.current,
  useArchiveClient: () => archive.current,
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
      archived: false,
      subscriptionOnFile: false,
      subscriptionActive: false,
      accessExpired: false,
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
    vi.restoreAllMocks();
    roster.current = {
      isPending: false,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
    archive.current = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      reset: vi.fn(),
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

  it('hides archived clients until that list is opened', async () => {
    roster.current = {
      isPending: false,
      isError: false,
      data: {
        clients: [
          CLIENTS.clients[0]!,
          {
            ...CLIENTS.clients[0]!,
            id: 'archived-1',
            name: 'Archived Olena',
            archived: true,
          },
        ],
      },
      refetch: vi.fn(),
    };
    renderPage('en');
    expect(
      screen.getByRole('link', { name: 'Olena Koval' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Archived Olena' })).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Archived clients' }),
    );
    expect(
      screen.getByRole('link', { name: 'Archived Olena' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Archive Archived Olena' }),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'Olena Koval' })).toBeNull();
  });

  it('asks before archiving and leaves the client in place when it fails', async () => {
    archive.current.mutate.mockImplementation(() => {
      archive.current.isError = true;
    });
    roster.current = {
      isPending: false,
      isError: false,
      data: CLIENTS,
      refetch: vi.fn(),
    };
    const view = renderPage('en');
    expect(archive.current.mutate).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Archive Olena Koval' }),
    );
    expect(archive.current.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Archive Olena Koval?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'They will not be able to sign in. Their program, workouts, and photos stay.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(archive.current.mutate).toHaveBeenCalledWith('client-1');
    view.rerender(
      <I18nTestProvider locale="en">
        <CoachClientsPage />
      </I18nTestProvider>,
    );
    expect(
      screen.getByText('This client could not be archived.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Olena Koval', hidden: true }),
    ).toBeInTheDocument();
  });

  it('removes an archived client from the active roster after success', async () => {
    archive.current.mutate.mockImplementation(() => {
      roster.current = {
        ...roster.current,
        data: {
          clients: [{ ...CLIENTS.clients[0]!, archived: true }],
        },
      };
    });
    roster.current = {
      isPending: false,
      isError: false,
      data: CLIENTS,
      refetch: vi.fn(),
    };
    const view = renderPage('en');
    await userEvent.click(
      screen.getByRole('button', { name: 'Archive Olena Koval' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    view.rerender(
      <I18nTestProvider locale="en">
        <CoachClientsPage />
      </I18nTestProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Olena Koval' })).toBeNull();
    expect(screen.getByText('No active clients.')).toBeInTheDocument();
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

  it('sorts the roster by name, then reverses it', async () => {
    roster.current = {
      isPending: false,
      isError: false,
      data: {
        clients: [
          CLIENTS.clients[0]!,
          { ...CLIENTS.clients[0]!, id: 'client-2', name: 'Anna' },
        ],
      },
      refetch: vi.fn(),
    };
    renderPage('en');
    const clientLinks = () =>
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.startsWith('/coach/clients/'));
    expect(clientLinks()).toEqual([
      '/coach/clients/client-1',
      '/coach/clients/client-2',
    ]);
    const nameSort = () => screen.getAllByRole('button', { name: 'Name' })[0]!;
    await userEvent.click(nameSort());
    expect(clientLinks()).toEqual([
      '/coach/clients/client-2',
      '/coach/clients/client-1',
    ]);
    await userEvent.click(nameSort());
    expect(clientLinks()).toEqual([
      '/coach/clients/client-1',
      '/coach/clients/client-2',
    ]);
  });

  it('keeps a workout on the 14-day cutoff and treats a missing log as quiet', () => {
    const now = Date.parse('2026-05-16T00:00:00.000Z');
    expect(missedRecentWorkout(null, now)).toBe(true);
    expect(
      missedRecentWorkout(
        new Date(now - QUIET_WINDOW_MS - 1).toISOString(),
        now,
      ),
    ).toBe(true);
    expect(
      missedRecentWorkout(new Date(now - QUIET_WINDOW_MS).toISOString(), now),
    ).toBe(false);
  });

  it('filters the active roster and keeps search and sort', async () => {
    const now = Date.parse('2026-05-16T00:00:00.000Z');
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const recent = new Date(now - 60_000).toISOString();
    const quiet = new Date(now - QUIET_WINDOW_MS - 1).toISOString();
    const edge = new Date(now - QUIET_WINDOW_MS).toISOString();
    const base = CLIENTS.clients[0]!;
    roster.current = {
      isPending: false,
      isError: false,
      data: {
        clients: [
          { ...base, id: 'recent', name: 'Recent', lastWorkoutAt: recent },
          { ...base, id: 'quiet', name: 'Quiet', lastWorkoutAt: quiet },
          {
            ...base,
            id: 'none',
            name: 'None',
            lastWorkoutAt: null,
            programAssigned: false,
            programName: null,
          },
          {
            ...base,
            id: 'edge',
            name: 'Edge',
            lastWorkoutAt: edge,
          },
          {
            ...base,
            id: 'lapsed',
            name: 'Lapsed',
            lastWorkoutAt: recent,
            subscriptionOnFile: true,
            subscriptionActive: false,
            accessExpired: true,
          },
          {
            ...base,
            id: 'pending',
            name: 'Pending',
            lastWorkoutAt: recent,
            subscriptionOnFile: true,
            subscriptionActive: false,
            accessExpired: false,
          },
          {
            ...base,
            id: 'archived',
            name: 'Archived',
            archived: true,
            lastWorkoutAt: null,
            programAssigned: false,
            accessExpired: true,
          },
        ],
      },
      refetch: vi.fn(),
    };
    renderPage('en');

    await userEvent.click(
      screen.getByRole('button', { name: 'No workout in 14 days' }),
    );
    expect(screen.getByRole('link', { name: 'Quiet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'None' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edge' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Recent' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Archived' })).toBeNull();
    expect(screen.getByText('2 clients')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'No program' }));
    expect(screen.getByRole('link', { name: 'None' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quiet' })).toBeNull();

    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(
      screen.getByText('No clients match this search.'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 client')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox'));

    await userEvent.click(screen.getByRole('button', { name: 'No program' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'No workout in 14 days' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Access expired' }),
    );
    expect(screen.getByRole('link', { name: 'Lapsed' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pending' })).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: 'Access expired' }),
    );
    const nameSort = () => screen.getAllByRole('button', { name: 'Name' })[0]!;
    await userEvent.click(nameSort());
    expect(
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.startsWith('/coach/clients/')),
    ).toEqual([
      '/coach/clients/edge',
      '/coach/clients/lapsed',
      '/coach/clients/none',
      '/coach/clients/pending',
      '/coach/clients/quiet',
      '/coach/clients/recent',
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Archived clients' }),
    );
    expect(
      screen.queryByRole('button', { name: 'No workout in 14 days' }),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Archived' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quiet' })).toBeNull();
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
