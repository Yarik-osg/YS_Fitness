import type { ReactNode } from 'react';
import type { TrainerProgramTemplateDetail } from '@repo/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import { I18nTestProvider } from '@/test/i18n';
import { CoachProgramPage } from './coach-program-page';

const routerPush = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({
  program: null as TrainerProgramTemplateDetail | null,
  rename: vi.fn(),
  remove: vi.fn(),
}));

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
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('@/lib/api/coach-programs', () => ({
  getCoachProgram: () => Promise.resolve(api.program),
  renameCoachProgram: (...args: unknown[]) => api.rename(...args),
  deleteCoachProgram: (...args: unknown[]) => api.remove(...args),
  duplicateCoachProgram: vi.fn(),
}));

const PROGRAM: TrainerProgramTemplateDetail = {
  id: 'template-1',
  code: 'Tcustom',
  name: 'Upper',
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  origin: 'TRAINER',
  active: true,
  ownerId: 'coach-1',
  dayCount: 1,
  exerciseCount: 1,
  assignedCount: 0,
  logCount: 2,
  days: [
    {
      dayNumber: 1,
      exercises: [
        {
          order: 1,
          sets: 3,
          allowsAbsAddon: false,
          exercise: {
            id: 'exercise-1',
            code: 'EX_039',
            name: 'Тяга',
            nameEn: 'Row',
            muscleGroups: ['BACK'],
            repsMin: 8,
            repsMax: 12,
          },
        },
      ],
    },
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nTestProvider locale="en">
        <CoachProgramPage templateId="template-1" />
      </I18nTestProvider>
    </QueryClientProvider>,
  );
}

describe('CoachProgramPage', () => {
  beforeEach(() => {
    cleanup();
    routerPush.mockReset();
    api.rename.mockReset();
    api.remove.mockReset();
    api.program = { ...PROGRAM, days: PROGRAM.days };
  });

  it('renames a program that already has logs', async () => {
    const user = userEvent.setup();
    api.rename.mockImplementation(
      async (_id: string, body: { name: string }) => {
        api.program = { ...api.program!, name: body.name };
        return api.program;
      },
    );
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Upper' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 times\/week/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(input);
    await user.type(input, 'Renamed block');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Renamed block' }),
      ).toBeInTheDocument();
    });
    expect(api.rename).toHaveBeenCalledWith('template-1', {
      name: 'Renamed block',
    });
  });

  it('warns that history stays, then shows a delete error', async () => {
    const user = userEvent.setup();
    api.remove.mockRejectedValue(
      new ApiClientError(409, 'TEMPLATE_IN_USE', 'assigned'),
    );
    renderPage();

    await screen.findByRole('heading', { name: 'Upper' });
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      screen.queryByRole('textbox', { name: 'Name' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Workout history stays/)).toBeInTheDocument();
    const confirm = screen.getAllByRole('button', { name: 'Delete' })[1]!;
    expect(confirm.className).toMatch(/text-amber/);
    expect(confirm.className).not.toMatch(/bg-accent/);
    expect(confirm.parentElement).toHaveClass('shrink-0');
    expect(confirm.parentElement?.className).not.toMatch(/flex-wrap/);
    await user.click(confirm);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An assigned program cannot be deleted.',
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('hides delete while a client is assigned', async () => {
    api.program = { ...PROGRAM, assignedCount: 1, logCount: 0 };
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Rename' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
  });
});
