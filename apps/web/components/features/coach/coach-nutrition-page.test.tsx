import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { CoachNutritionPage } from './coach-nutrition-page';

const roster = vi.hoisted(() => ({
  current: {
    data: undefined as
      | {
          clients: Array<{
            id: string;
            email: string;
            name: string | null;
            archived: boolean;
            target: {
              source: 'CALCULATED' | 'MANUAL';
              targetCalories: string;
              proteinGrams: string;
              fatGrams: string;
              carbsGrams: string;
            } | null;
            inputs: {
              sex: 'FEMALE' | 'MALE';
              ageYears: number | null;
              heightCm: string;
              weightKg: string | null;
              activity: 'SEDENTARY' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
              frequency: string | null;
              goal:
                'LOSE_WEIGHT' | 'MAINTAIN' | 'GAIN_MUSCLE' | 'RECOMPOSITION';
            } | null;
          }>;
        }
      | undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/hooks/use-coach-clients', () => ({
  useCoachNutritionRoster: () => roster.current,
}));

const exportFile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/coach', () => ({
  exportCoachTable: exportFile,
}));

function renderPage() {
  return render(
    <I18nTestProvider locale="en">
      <CoachNutritionPage />
    </I18nTestProvider>,
  );
}

describe('CoachNutritionPage', () => {
  beforeEach(() => {
    cleanup();
    roster.current = {
      data: {
        clients: [
          {
            id: 'anna',
            email: 'anna@example.com',
            name: 'Anna',
            archived: false,
            target: {
              source: 'MANUAL',
              targetCalories: '1800',
              proteinGrams: '130',
              fatGrams: '50',
              carbsGrams: '180.4',
            },
            inputs: {
              sex: 'FEMALE',
              ageYears: 30,
              heightCm: '165',
              weightKg: '60.5',
              activity: 'HIGH',
              frequency: '3',
              goal: 'RECOMPOSITION',
            },
          },
          {
            id: 'blank',
            email: 'blank@example.com',
            name: null,
            archived: true,
            target: null,
            inputs: null,
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    exportFile.mockReset();
  });

  it('shows every client target beside the formula inputs', async () => {
    renderPage();

    expect(
      screen.getByText(/Activity and goal are the values the formula uses/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anna' })).toHaveAttribute(
      'href',
      '/coach/clients/anna',
    );
    expect(screen.getByText('anna@example.com')).toBeInTheDocument();
    expect(screen.queryByText('blank@example.com')).toBeNull();
    expect(screen.getByRole('cell', { name: /1800/ })).toBeInTheDocument();
    expect(screen.getByText('By hand')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '130' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '50' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '180' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Target' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Per week' })).toBeNull();
    expect(screen.getByRole('cell', { name: 'Female' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '30' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '165 cm' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '60.5 kg' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'High' })).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'Recomposition' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('from the nutrition profile')).toBeNull();
    expect(screen.queryByRole('link', { name: 'No name' })).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: 'Archived clients' }),
    );
    expect(screen.queryByRole('link', { name: 'Anna' })).toBeNull();
    expect(screen.getByRole('link', { name: 'No name' })).toBeInTheDocument();
    expect(screen.getByText('blank@example.com')).toBeInTheDocument();
    expect(screen.queryByText('anna@example.com')).toBeNull();
    expect(screen.getByRole('cell', { name: 'None' })).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Active clients' }),
    );
    await userEvent.type(screen.getByRole('searchbox'), 'missing');
    expect(
      screen.getByText('No clients match this search.'),
    ).toBeInTheDocument();
  });

  it('exports the nutrition rows on screen', async () => {
    exportFile.mockResolvedValue(new Blob(['xlsx']));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderPage();
    await userEvent.click(
      screen.getByRole('button', { name: 'Export to Excel' }),
    );
    expect(exportFile).toHaveBeenCalledTimes(1);
    expect(exportFile.mock.calls[0]?.[0].sheet).toBe('Nutrition');
    expect(exportFile.mock.calls[0]?.[0].rows).toEqual([
      expect.arrayContaining(['Anna', 'anna@example.com', '1800 By hand']),
    ]);
  });
});
