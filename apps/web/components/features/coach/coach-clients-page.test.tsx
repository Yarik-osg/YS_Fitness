import type { CoachClientsResponse } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { CoachClientsPage } from './coach-clients-page';

const roster = vi.hoisted(() => ({
  current: {
    isPending: false,
    isError: false,
    data: undefined as CoachClientsResponse | undefined,
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
      subscriptionActive: false,
    },
  ],
};

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
    roster.current = { isPending: false, isError: false, data: undefined };
  });

  it('shows a loading state', () => {
    roster.current = { isPending: true, isError: false, data: undefined };
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
    };
    renderPage();
    expect(screen.getByText('Клієнтів ще немає.')).toBeInTheDocument();
    expect(screen.getByText('0 клієнтів')).toBeInTheDocument();
  });

  it('shows clients in Ukrainian and English', () => {
    roster.current = { isPending: false, isError: false, data: CLIENTS };
    const view = renderPage('uk');
    expect(
      screen.getByRole('heading', { name: 'Клієнти' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Olena Koval')).toBeInTheDocument();
    expect(screen.getByText('olena@example.com')).toBeInTheDocument();
    expect(screen.getByText('Заповнена')).toBeInTheDocument();
    expect(screen.getByText('Призначена')).toBeInTheDocument();
    expect(screen.getByText('Неактивний')).toBeInTheDocument();

    view.rerender(
      <I18nTestProvider locale="en">
        <CoachClientsPage />
      </I18nTestProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Clients' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows an error', () => {
    roster.current = { isPending: false, isError: true, data: undefined };
    renderPage('en');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Clients could not be loaded.',
    );
  });
});
