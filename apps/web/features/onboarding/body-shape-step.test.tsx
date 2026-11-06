import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nTestProvider } from '@/test/i18n';
import { BodyShapeStep } from './body-shape-step';

function renderStep(sex: 'male' | 'female') {
  const changes: Array<[number, number]> = [];
  const view = render(
    <I18nTestProvider>
      <BodyShapeStep
        sex={sex}
        muscle={40}
        fat={70}
        onChange={(muscle, fat) => changes.push([muscle, fat])}
      />
    </I18nTestProvider>,
  );
  return { changes, ...view };
}

describe('BodyShapeStep', () => {
  afterEach(() => cleanup());

  it('shows the model for the sex already chosen in onboarding', () => {
    const female = renderStep('female');
    expect(female.container.querySelector('[data-sex="female"]')).toBeTruthy();
    female.unmount();
    const male = renderStep('male');
    expect(male.container.querySelector('[data-sex="male"]')).toBeTruthy();
  });

  it('moves one slider without changing the other', async () => {
    const user = userEvent.setup();
    const changes = renderStep('female').changes;
    const [muscle, fat] = screen.getAllByRole('slider');
    muscle?.focus();
    await user.keyboard('{ArrowRight}');
    fat?.focus();
    await user.keyboard('{ArrowLeft}');

    expect(changes).toEqual([
      [41, 70],
      [40, 69],
    ]);
  });

  it('loads the previously saved values onto the sliders', () => {
    renderStep('male');
    const [muscle, fat] = screen.getAllByRole('slider');
    expect(muscle).toHaveAttribute('aria-valuenow', '40');
    expect(fat).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByText('Помірний')).toBeInTheDocument();
    expect(screen.getByText('Високий')).toBeInTheDocument();
  });
});
