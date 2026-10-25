import type { ReactNode } from 'react';
import type { CoachProgramClientsResponse } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { CoachProgramClientsPage } from './coach-program-clients-page';

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

const query = vi.hoisted(() => ({
  current: {
    isPending: false,
    isError: false,
    error: null as Error | null,
    data: undefined as CoachProgramClientsResponse | undefined,
    refetch: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/use-coach-clients', () => ({
  useProgramClients: () => query.current,
}));

const CLIENT = {
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
};

function renderPage() {
  return render(
    <I18nTestProvider locale="en">
      <CoachProgramClientsPage templateId="template-1" />
    </I18nTestProvider>,
  );
}

describe('CoachProgramClientsPage', () => {
  beforeEach(() => {
    cleanup();
    query.current = {
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      refetch: vi.fn(),
    };
  });

  it('links assignees to their file and keeps an archived client', () => {
    query.current = {
      ...query.current,
      data: {
        programName: 'Upper split',
        clients: [
          CLIENT,
          {
            ...CLIENT,
            id: 'client-2',
            name: 'Archived Olena',
            email: 'old@example.com',
            archived: true,
            lastWorkoutAt: null,
          },
        ],
      },
    };
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Upper split' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Olena Koval' })).toHaveAttribute(
      'href',
      '/coach/clients/client-1',
    );
    expect(
      screen.getByRole('link', { name: 'Archived Olena' }),
    ).toHaveAttribute('href', '/coach/clients/client-2');
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to programs' }),
    ).toHaveAttribute('href', '/coach/programs');
  });

  it('filters the assigned clients by name', async () => {
    query.current = {
      ...query.current,
      data: {
        programName: 'Upper split',
        clients: [CLIENT, { ...CLIENT, id: 'client-2', name: 'Ihor' }],
      },
    };
    renderPage();
    await userEvent.type(screen.getByRole('searchbox'), 'ihor');
    expect(screen.getByRole('link', { name: 'Ihor' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Olena Koval' })).toBeNull();
    expect(screen.getByText('2 clients')).toBeInTheDocument();
  });

  it('shows an empty assignment', () => {
    query.current = {
      ...query.current,
      data: { programName: 'Upper split', clients: [] },
    };
    renderPage();
    expect(
      screen.getByText('No clients are assigned to this program.'),
    ).toBeInTheDocument();
  });

  it('shows a missing program', () => {
    query.current = {
      ...query.current,
      isError: true,
      error: new ApiClientError(404, 'TEMPLATE_NOT_FOUND', 'missing'),
    };
    renderPage();
    expect(
      screen.getByText('This program could not be found.'),
    ).toBeInTheDocument();
  });
});
