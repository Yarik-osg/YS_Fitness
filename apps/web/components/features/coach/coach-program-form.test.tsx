import type { ExerciseResponse } from '@repo/shared-types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { CoachProgramForm } from './coach-program-form';

const exercises: ExerciseResponse[] = [
  {
    id: 'squat',
    code: 'SQ',
    name: 'Присідання',
    nameEn: 'Squat',
    muscleGroups: ['QUADRICEPS'],
    repsMin: 8,
    repsMax: 12,
  },
  {
    id: 'curl',
    code: 'CU',
    name: 'Згинання рук з гантелями',
    nameEn: 'Dumbbell curl',
    muscleGroups: ['BICEPS'],
    repsMin: 10,
    repsMax: 15,
  },
];

describe('CoachProgramForm exercise search', () => {
  beforeEach(() => {
    cleanup();
  });

  it('filters the catalog and applies the chosen exercise', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nTestProvider locale="uk">
        <CoachProgramForm
          exercises={exercises}
          pending={false}
          error={null}
          onSubmit={onSubmit}
        />
      </I18nTestProvider>,
    );

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Присідання' })[0]!,
    );
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Знайти вправу' }),
      'гантел',
    );

    expect(
      screen.getByRole('option', { name: 'Згинання рук з гантелями' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Присідання' }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('option', { name: 'Згинання рук з гантелями' }),
    );

    expect(
      screen.getAllByRole('button', { name: 'Згинання рук з гантелями' })[0],
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('Повтори від')[0]).toHaveValue(10);
    expect(screen.getAllByLabelText('Повтори до')[0]).toHaveValue(15);
  });

  it('keeps Enter inside the exercise search', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nTestProvider locale="uk">
        <CoachProgramForm
          exercises={exercises}
          pending={false}
          error={null}
          onSubmit={onSubmit}
        />
      </I18nTestProvider>,
    );

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Назва' }),
      'Тест',
    );
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Присідання' })[0]!,
    );
    const search = screen.getByRole('combobox', { name: 'Знайти вправу' });
    await userEvent.type(search, 'немає');
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(search);
    await userEvent.type(search, 'гантел');
    await userEvent.keyboard('{Enter}');
    expect(
      screen.getAllByRole('button', { name: 'Згинання рук з гантелями' })[0],
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('gives the abs option a large checkbox and steps the rep count', async () => {
    render(
      <I18nTestProvider locale="uk">
        <CoachProgramForm
          exercises={exercises}
          pending={false}
          error={null}
          onSubmit={vi.fn()}
        />
      </I18nTestProvider>,
    );

    const abs = screen.getAllByRole('checkbox', {
      name: 'Додатковий прес',
    })[0]!;
    expect(abs).toHaveClass('size-6');
    await userEvent.click(abs);
    expect(abs).toBeChecked();

    const reps = screen.getAllByLabelText('Повтори від')[0]!;
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Збільшити Повтори від' })[0]!,
    );
    expect(reps).toHaveValue(9);
  });
});
