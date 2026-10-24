import type { ReactNode } from 'react';
import type { TrainerProgramTemplateListResponse } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { CoachProgramsPage } from './coach-programs-page';

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

const catalog = vi.hoisted(() => ({
  current: {
    isPending: false,
    isError: false,
    data: undefined as TrainerProgramTemplateListResponse | undefined,
    refetch: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/use-coach-programs', () => ({
  useCoachPrograms: () => catalog.current,
}));

const PROGRAMS: TrainerProgramTemplateListResponse = {
  templates: [
    {
      id: 'system-1',
      code: 'WB2U',
      name: 'WB2U — Жінки · Початковий рівень · 2 тренування на тиждень · Акцент на верх',
      gender: 'female',
      level: 'beginner',
      frequencyPerWeek: 2,
      accent: 'NONE',
      origin: 'SYSTEM',
      active: true,
      ownerId: null,
      dayCount: 2,
      exerciseCount: 8,
    },
  ],
};

function renderPage() {
  return render(
    <I18nTestProvider locale="en">
      <CoachProgramsPage />
    </I18nTestProvider>,
  );
}

describe('CoachProgramsPage', () => {
  beforeEach(() => {
    cleanup();
    catalog.current = {
      isPending: false,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
  });

  it('shows a loading state', () => {
    catalog.current.isPending = true;
    renderPage();
    expect(
      screen.getByRole('main').querySelector('[aria-busy="true"]'),
    ).toBeTruthy();
  });

  it('shows an empty catalog', () => {
    catalog.current.data = { templates: [] };
    renderPage();
    expect(screen.getByText('No programs yet.')).toBeInTheDocument();
  });

  it('shows a failure and retries', async () => {
    const refetch = vi.fn();
    catalog.current = {
      isPending: false,
      isError: true,
      data: undefined,
      refetch,
    };
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Programs could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('keeps a custom program name that the coach wrote', () => {
    catalog.current.data = {
      templates: [
        {
          ...PROGRAMS.templates[0]!,
          id: 'custom-1',
          code: 'custom-1',
          name: 'Силова на 4 дні',
          origin: 'TRAINER',
          ownerId: 'admin-1',
        },
      ],
    };
    renderPage();
    expect(
      screen.getByRole('link', { name: 'Силова на 4 дні' }),
    ).toBeInTheDocument();
    catalog.current.data = {
      templates: [
        {
          ...PROGRAMS.templates[0]!,
          id: 'custom-2',
          code: 'custom-2',
          name: 'Сила — груди · 4',
          origin: 'TRAINER',
          ownerId: 'admin-1',
        },
      ],
    };
    cleanup();
    renderPage();
    expect(
      screen.getByRole('link', { name: 'Сила — груди · 4' }),
    ).toBeInTheDocument();
  });

  it('shortens a copied catalog name to the code before the subtitle', () => {
    catalog.current.data = {
      templates: [
        {
          ...PROGRAMS.templates[0]!,
          id: 'copy-1',
          code: 'generated',
          name: `${PROGRAMS.templates[0]!.name} - copy`,
          origin: 'TRAINER',
          ownerId: 'admin-1',
        },
      ],
    };
    renderPage();
    expect(
      screen.getByRole('link', { name: 'WB2U - copy' }),
    ).toBeInTheDocument();
  });

  it('shows a system program separately from a custom one', async () => {
    catalog.current.data = PROGRAMS;
    renderPage();
    expect(screen.getByText('1 program')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WB2U' })).toHaveAttribute(
      'href',
      '/coach/programs/system-1',
    );
    expect(
      screen.getByRole('columnheader', { name: 'Track' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Women').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('columnheader', { name: 'Frequency' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Source' }),
      'TRAINER',
    );
    expect(
      screen.queryByRole('link', { name: 'WB2U' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('No programs in this group.')).toBeInTheDocument();
    expect(screen.getByText('0 programs')).toBeInTheDocument();
  });

  it('searches the visible program text', async () => {
    catalog.current.data = PROGRAMS;
    renderPage();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search programs' }),
      'zzzz',
    );
    expect(screen.getByText('No programs in this group.')).toBeInTheDocument();
  });

  it('sorts programs by days', async () => {
    catalog.current.data = {
      templates: [
        PROGRAMS.templates[0]!,
        {
          ...PROGRAMS.templates[0]!,
          id: 'system-4',
          code: 'MB4',
          name: 'MB4',
          dayCount: 4,
          gender: 'male',
        },
      ],
    };
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Days' }));
    const links = () =>
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
        .filter(
          (href) =>
            href?.startsWith('/coach/programs/') &&
            href !== '/coach/programs/new',
        );
    expect(links()[0]).toBe('/coach/programs/system-4');
    await userEvent.click(screen.getByRole('button', { name: 'Days' }));
    expect(links()[0]).toBe('/coach/programs/system-1');
  });
});
