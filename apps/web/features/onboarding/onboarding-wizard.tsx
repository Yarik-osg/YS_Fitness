'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ActivityLevel } from '@repo/shared-types';
import {
  HEIGHT_CM,
  WEIGHT_KG,
  isPlausibleDateOfBirth,
  isValidPersonName,
  onboardingProfileSchema,
} from '@repo/validation';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { getUserFacingError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { clearSessionHint } from '@/lib/auth/session-cookie';
import { useSaveOnboarding } from '@/lib/hooks/use-users';
import { useAuthStore } from '@/lib/stores/auth-store';
import { resolvePostQuizAccessHref } from '@/lib/subscriptions/plan-cta';
import {
  persistProgramTrack,
  readSelectedPlanId,
} from '@/lib/subscriptions/selected-plan';
import { ActivitySlider } from './activity-slider';
import { BodyCarousel } from './body-carousel';
import {
  bodySliderSrc,
  currentBodyPhoto,
  desiredBodyPhoto,
} from './body-figure';
import { ChoiceList, MultiChoiceList, type Choice } from './choice-list';
import { previewProgramId } from './preview-program';
import {
  reportOnboardingSubmitError,
  useOnboardingHydrated,
  useOnboardingStore,
  type OnboardingState,
  type OnboardingSubmitError,
} from './onboarding-store';
import { validateOnboardingDraft } from './payload';
import {
  biologicalSexFromProgramTrack,
  ONBOARDING_WIZARD_STEPS,
} from './program-track';
import { StepShell } from './step-shell';

const CURRENT_BODY_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const DESIRED_BODY_STEPS = [0, 1, 2, 3] as const;

const TOTAL_STEPS = ONBOARDING_WIZARD_STEPS;

const TRACK_BOUND_RESET = {
  currentBody: undefined,
  physiqueLevel: undefined,
  focusAreas: [],
  mealsPerDay: undefined,
  eatingHabits: [],
} satisfies Partial<OnboardingState>;

function MetricField({
  id,
  label,
  unit,
  invalid,
  children,
}: {
  id: string;
  label: string;
  unit?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block font-label text-[9px] font-semibold tracking-[0.16em] text-white/50 uppercase"
      >
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-2 border bg-white/4 px-4 py-3 focus-within:border-accent',
          invalid ? 'border-red-400' : 'border-white/12',
        )}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {unit ? (
          <span className="shrink-0 text-xs text-white/40">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 60;

function StepperMetricField({
  id,
  label,
  unit,
  value,
  min,
  max,
  step,
  emptyValue,
  placeholder,
  decreaseLabel,
  increaseLabel,
  error,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value?: number;
  min: number;
  max: number;
  step: number;
  emptyValue: number;
  placeholder: string;
  decreaseLabel: string;
  increaseLabel: string;
  error: string;
  onChange: (value: number | undefined) => void;
}) {
  const invalid = value !== undefined && (value < min || value > max);

  function bump(direction: 1 | -1) {
    const base =
      value === undefined || Number.isNaN(value) ? emptyValue : value;
    const next = Math.round((base + direction * step) / step) * step;
    onChange(Math.min(max, Math.max(min, next)));
  }

  return (
    <div>
      <MetricField id={id} label={label} unit={unit} invalid={invalid}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={decreaseLabel}
            onClick={() => bump(-1)}
            className="grid size-7 shrink-0 place-items-center text-white/45 transition hover:text-accent"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            value={value ?? ''}
            className={`${metricInputClass} appearance-none text-center`}
            onChange={(event) =>
              onChange(
                event.target.value ? event.target.valueAsNumber : undefined,
              )
            }
          />
          <button
            type="button"
            aria-label={increaseLabel}
            onClick={() => bump(1)}
            className="grid size-7 shrink-0 place-items-center text-white/45 transition hover:text-accent"
          >
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
        </div>
      </MetricField>
      {invalid ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const metricInputClass =
  'w-full border-0 bg-transparent p-0 font-heading text-[18px] text-white shadow-none outline-none ring-0 placeholder:text-white/25 focus:bg-transparent focus:outline-none focus:ring-0';

function accent(chunks: ReactNode) {
  return <span className="text-accent">{chunks}</span>;
}

export function OnboardingWizard() {
  const router = useRouter();
  const draft = useOnboardingStore();
  const hydrated = useOnboardingHydrated();
  const saveOnboarding = useSaveOnboarding();
  const t = useTranslations('onboarding');
  const tAuth = useTranslations('auth');
  const [phase, setPhase] = useState<'wizard' | 'analysis' | 'plan'>('wizard');

  const step = Math.min(Math.max(draft.step, 0), TOTAL_STEPS - 1);
  const male = draft.programTrack === 'male';
  const currentBodyChoices = useMemo(
    () =>
      CURRENT_BODY_STEPS.map((step) => ({
        value: String(step),
        label: t('variant', { index: step + 1 }),
        image: currentBodyPhoto(male ? 'male' : 'female', step),
      })),
    [male, t],
  );
  const desiredBodyChoices = useMemo(
    () =>
      DESIRED_BODY_STEPS.map((step) => ({
        value: String(step),
        label: t('variant', { index: step + 1 }),
        image: desiredBodyPhoto(male ? 'male' : 'female', step),
      })),
    [male, t],
  );

  const mainGoalChoices: Choice[] = [
    {
      value: 'lose_weight',
      label: t('choices.mainGoal.lose_weight'),
      icon: '↓',
    },
    {
      value: 'build_muscle',
      label: t('choices.mainGoal.build_muscle'),
      icon: '↑',
    },
    {
      value: 'improve_body',
      label: t('choices.mainGoal.improve_body'),
      icon: '◈',
    },
    { value: 'maintain', label: t('choices.mainGoal.maintain'), icon: '⟳' },
    {
      value: 'get_stronger',
      label: male
        ? t('choices.mainGoal.get_stronger_male')
        : t('choices.mainGoal.get_stronger_female'),
      icon: '⚡',
    },
  ];

  const activityLabels = {
    SEDENTARY: {
      label: t('choices.activity.SEDENTARY.label'),
      description: t('choices.activity.SEDENTARY.description'),
    },
    LIGHTLY_ACTIVE: {
      label: t('choices.activity.LIGHTLY_ACTIVE.label'),
      description: t('choices.activity.LIGHTLY_ACTIVE.description'),
    },
    MODERATELY_ACTIVE: {
      label: t('choices.activity.MODERATELY_ACTIVE.label'),
      description: t('choices.activity.MODERATELY_ACTIVE.description'),
    },
    VERY_ACTIVE: {
      label: t('choices.activity.VERY_ACTIVE.label'),
      description: t('choices.activity.VERY_ACTIVE.description'),
    },
  };

  const experienceChoices: Choice[] = [
    {
      value: 'beginner',
      label: t('choices.experience.beginner.label'),
      description: t('choices.experience.beginner.description'),
    },
    {
      value: 'intermediate',
      label: t('choices.experience.intermediate.label'),
      description: t('choices.experience.intermediate.description'),
    },
    {
      value: 'advanced',
      label: male
        ? t('choices.experience.advanced_male')
        : t('choices.experience.advanced_female'),
      description: t('choices.experience.advancedDescription'),
    },
  ];

  const frequencyChoices: Choice[] = [
    {
      value: '2',
      label: t('choices.frequency.2.label'),
      description: t('choices.frequency.2.description'),
    },
    {
      value: '3',
      label: t('choices.frequency.3.label'),
      description: t('choices.frequency.3.description'),
    },
    {
      value: '4',
      label: t('choices.frequency.4.label'),
      description: t('choices.frequency.4.description'),
    },
  ];

  const femaleFocus: Choice[] = [
    { value: 'glutes', label: t('choices.focus.glutes') },
    { value: 'legs', label: t('choices.focus.legs') },
    { value: 'shoulders', label: t('choices.focus.shoulders') },
    { value: 'back', label: t('choices.focus.back') },
    { value: 'arms', label: t('choices.focus.arms') },
    { value: 'abs', label: t('choices.focus.abs') },
    { value: 'full_body', label: t('choices.focus.full_body') },
  ];

  const maleFocus: Choice[] = [
    { value: 'chest', label: t('choices.focus.chest') },
    ...femaleFocus,
  ];

  const nutritionChoices: Choice[] = [
    { value: 'structured', label: t('choices.nutrition.structured') },
    { value: 'balanced', label: t('choices.nutrition.balanced') },
    { value: 'intuitive', label: t('choices.nutrition.intuitive') },
    { value: 'irregular', label: t('choices.nutrition.irregular') },
    { value: 'uncontrolled', label: t('choices.nutrition.uncontrolled') },
  ];

  const mealChoices: Choice[] = [
    {
      value: '1-2',
      label: t('choices.meals.1-2.label'),
      description: t('choices.meals.1-2.description'),
    },
    {
      value: '3',
      label: t('choices.meals.3.label'),
      description: t('choices.meals.3.description'),
    },
    {
      value: '4',
      label: t('choices.meals.4.label'),
      description: t('choices.meals.4.description'),
    },
    {
      value: '5+',
      label: t('choices.meals.5+.label'),
      description: t('choices.meals.5+.description'),
    },
    {
      value: 'no_schedule',
      label: t('choices.meals.no_schedule.label'),
      description: t('choices.meals.no_schedule.description'),
    },
  ];

  const maleMealChoices: Choice[] = [
    {
      value: '1-2',
      label: t('choices.mealsMale.1-2.label'),
      description: t('choices.mealsMale.1-2.description'),
    },
    {
      value: '3',
      label: t('choices.mealsMale.3.label'),
      description: t('choices.mealsMale.3.description'),
    },
    {
      value: '4-5',
      label: t('choices.mealsMale.4-5.label'),
      description: t('choices.mealsMale.4-5.description'),
    },
    {
      value: '6+',
      label: t('choices.mealsMale.6+.label'),
      description: t('choices.mealsMale.6+.description'),
    },
    {
      value: 'varies',
      label: t('choices.mealsMale.varies.label'),
      description: t('choices.mealsMale.varies.description'),
    },
  ];

  const femaleHabitChoices: Choice[] = [
    {
      value: 'evening_overeating',
      label: t('choices.habitsFemale.evening_overeating'),
    },
    { value: 'snacking', label: t('choices.habitsFemale.snacking') },
    {
      value: 'sweet_cravings',
      label: t('choices.habitsFemale.sweet_cravings'),
    },
    { value: 'fastfood', label: t('choices.habitsFemale.fastfood') },
    {
      value: 'skipping_meals',
      label: t('choices.habitsFemale.skipping_meals'),
    },
    { value: 'portions', label: t('choices.habitsFemale.portions') },
    { value: 'emotional', label: t('choices.habitsFemale.emotional') },
    { value: 'none', label: t('choices.habitsFemale.none') },
  ];

  const maleHabitChoices: Choice[] = [
    { value: 'late_eating', label: t('choices.habitsMale.late_eating') },
    { value: 'skipping', label: t('choices.habitsMale.skipping') },
    { value: 'emotional', label: t('choices.habitsMale.emotional') },
    { value: 'fast_food', label: t('choices.habitsMale.fast_food') },
    { value: 'sweets', label: t('choices.habitsMale.sweets') },
    { value: 'overeating', label: t('choices.habitsMale.overeating') },
    { value: 'irregular', label: t('choices.habitsMale.irregular') },
    { value: 'none', label: t('choices.habitsMale.none') },
  ];

  useEffect(() => {
    if (phase !== 'analysis') return;
    const timer = window.setTimeout(() => setPhase('plan'), 3400);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'plan' && draft.programTrack) {
      persistProgramTrack(draft.programTrack);
    }
  }, [draft.programTrack, phase]);

  useEffect(() => {
    if (step === 1 && !draft.currentBody && currentBodyChoices[0]) {
      useOnboardingStore.setState({ currentBody: currentBodyChoices[0].value });
    }
    if (step === 6 && !draft.activityLevel) {
      useOnboardingStore.setState({ activityLevel: 'MODERATELY_ACTIVE' });
    }
    if (
      step === 11 &&
      (draft.heightCm === undefined || draft.weightKg === undefined)
    ) {
      useOnboardingStore.setState({
        heightCm: draft.heightCm ?? DEFAULT_HEIGHT_CM,
        weightKg: draft.weightKg ?? DEFAULT_WEIGHT_KG,
      });
    }
  }, [currentBodyChoices, draft, step]);

  function previous() {
    if (step === 0) {
      router.push('/');
      return;
    }
    draft.setStep(step - 1);
  }

  async function next() {
    if (!isCurrentStepValid()) return;
    if (draft.submitError)
      useOnboardingStore.setState({ submitError: undefined });
    if (step < TOTAL_STEPS - 1) {
      draft.setStep(step + 1);
      return;
    }

    if (!useAuthStore.getState().accessToken) {
      setPhase('analysis');
      return;
    }

    const validation = validateOnboardingDraft(draft);
    if (!validation.ok) {
      reportOnboardingSubmitError(validation.step, {
        code: 'ONBOARDING_INCOMPLETE',
      });
      return;
    }

    try {
      await saveOnboarding.mutateAsync(validation.payload);
      setPhase('analysis');
    } catch {
      // The mutation error is rendered without clearing the persisted draft.
    }
  }

  function submitErrorMessage(error: OnboardingSubmitError) {
    if (error.code === 'ONBOARDING_INCOMPLETE') return t('errors.incomplete');
    if (error.code === 'INVALID_DATE_OF_BIRTH') return t('errors.dateOfBirth');
    return getUserFacingError(
      error.status === undefined
        ? error
        : new ApiClientError(error.status, error.code, error.message ?? ''),
      tAuth,
    );
  }

  function isCurrentStepValid() {
    switch (step) {
      case 0:
        return Boolean(draft.programTrack);
      case 1:
        return Boolean(draft.currentBody);
      case 2:
        return Boolean(draft.desiredBody);
      case 3:
        return Boolean(draft.mainGoal);
      case 4:
        return Boolean(draft.experience);
      case 5:
        return Boolean(draft.trainingFrequency);
      case 6:
        return Boolean(draft.activityLevel);
      case 7:
        return draft.focusAreas.length > 0;
      case 8:
        return Boolean(draft.nutritionCurrent);
      case 9:
        return Boolean(draft.mealsPerDay);
      case 10:
        return draft.eatingHabits.length > 0;
      case 11:
        return (
          isValidPersonName(draft.name ?? '') &&
          onboardingProfileSchema
            .pick({ dateOfBirth: true, heightCm: true, weightKg: true })
            .safeParse({
              dateOfBirth: draft.dateOfBirth,
              heightCm: draft.heightCm,
              weightKg: draft.weightKg,
            }).success &&
          isPlausibleDateOfBirth(draft.dateOfBirth ?? '')
        );
      default:
        return false;
    }
  }

  const dateWellFormed = /^\d{4}-\d{2}-\d{2}$/.test(draft.dateOfBirth ?? '');
  const dateImplausible =
    dateWellFormed && !isPlausibleDateOfBirth(draft.dateOfBirth ?? '');
  const nameTyped = Boolean(draft.name?.trim());
  const nameInvalid = nameTyped && !isValidPersonName(draft.name ?? '');

  const trackClass =
    step === 0 ? undefined : male ? 'track-male' : 'track-female';
  const shellClass = trackClass;

  if (!hydrated) return <DraftLoading />;
  if (phase === 'analysis') return <Analysis className={shellClass} />;
  if (phase === 'plan') {
    return (
      <Plan
        draft={draft}
        className={shellClass}
        onContinue={() => {
          const planId = readSelectedPlanId();
          const authenticated = Boolean(useAuthStore.getState().accessToken);
          if (!authenticated) {
            clearSessionHint();
          }
          router.push(
            resolvePostQuizAccessHref({
              authenticated,
              planId,
            }),
          );
        }}
      />
    );
  }

  const common = {
    step,
    total: TOTAL_STEPS,
    onBack: previous,
    onContinue: () => void next(),
    canContinue: isCurrentStepValid(),
    pending: saveOnboarding.isPending,
    error: draft.submitError
      ? submitErrorMessage(draft.submitError)
      : saveOnboarding.error
        ? getUserFacingError(saveOnboarding.error, tAuth)
        : null,
    className: trackClass,
    continueLabel: step === 1 ? t('chooseForm') : undefined,
    continueClassName:
      step === 0 && male
        ? 'bg-[#c8ff2e] text-[#0b0b0b] shadow-none'
        : step === 0 && draft.programTrack === 'female'
          ? 'bg-[#00c7c8] text-[#0b0b0b] shadow-none'
          : undefined,
  };

  switch (step) {
    case 0:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.program.eyebrow')}
          title={t.rich('steps.program.title', { accent })}
          description={t('steps.program.description')}
        >
          <ChoiceList
            value={draft.programTrack}
            onChange={(value) => {
              const programTrack = value as 'female' | 'male';
              draft.setAnswer({
                programTrack,
                biologicalSexForCalculation:
                  biologicalSexFromProgramTrack(programTrack),
                ...(draft.programTrack && draft.programTrack !== programTrack
                  ? TRACK_BOUND_RESET
                  : {}),
              });
            }}
            choices={[
              {
                value: 'female',
                label: t('choices.program.female.label'),
                description: t('choices.program.female.description'),
                image: '/marketing/hero.png',
              },
              {
                value: 'male',
                label: t('choices.program.male.label'),
                description: t('choices.program.male.description'),
                image: bodySliderSrc('male', 6),
              },
            ]}
          />
        </StepShell>
      );
    case 1:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.currentBody.eyebrow')}
          title={t.rich('steps.currentBody.title', { accent })}
          description={t('steps.currentBody.description')}
        >
          <BodyCarousel
            choices={currentBodyChoices}
            value={draft.currentBody}
            label={t('physiqueSlider.label')}
            onChange={(currentBody) => draft.setAnswer({ currentBody })}
          />
        </StepShell>
      );
    case 2:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.desiredBody.eyebrow')}
          title={t.rich('steps.desiredBody.title', { accent })}
          description={t('steps.desiredBody.description')}
        >
          <ChoiceList
            grid
            imageGrid
            choices={desiredBodyChoices}
            value={draft.desiredBody}
            onChange={(desiredBody) => draft.setAnswer({ desiredBody })}
          />
        </StepShell>
      );
    case 3:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.mainGoal.eyebrow')}
          title={t.rich('steps.mainGoal.title', { accent })}
        >
          <ChoiceList
            goal
            choices={mainGoalChoices}
            value={draft.mainGoal}
            onChange={(mainGoal) => draft.setAnswer({ mainGoal })}
          />
        </StepShell>
      );
    case 4:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.experience.eyebrow')}
          title={t.rich('steps.experience.title', { accent })}
        >
          <ChoiceList
            choices={experienceChoices}
            value={draft.experience}
            onChange={(experience) => draft.setAnswer({ experience })}
          />
        </StepShell>
      );
    case 5:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.frequency.eyebrow')}
          title={t.rich(
            male ? 'steps.frequency.titleMale' : 'steps.frequency.titleFemale',
            { accent },
          )}
          description={t('steps.frequency.description')}
        >
          <ChoiceList
            choices={frequencyChoices}
            value={draft.trainingFrequency}
            onChange={(trainingFrequency) =>
              draft.setAnswer({ trainingFrequency })
            }
          />
        </StepShell>
      );
    case 6:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.activity.eyebrow')}
          title={t.rich('steps.activity.title', { accent })}
          description={t('steps.activity.description')}
        >
          <ActivitySlider
            value={draft.activityLevel}
            labels={activityLabels}
            label={t('steps.activity.eyebrow')}
            onChange={(activityLevel: ActivityLevel) =>
              draft.setAnswer({ activityLevel })
            }
          />
        </StepShell>
      );
    case 7:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.focus.eyebrow')}
          title={t.rich('steps.focus.title', { accent })}
          description={t('steps.focus.description')}
        >
          <MultiChoiceList
            single
            choices={male ? maleFocus : femaleFocus}
            value={draft.focusAreas}
            onChange={(focusAreas) => draft.setAnswer({ focusAreas })}
          />
        </StepShell>
      );
    case 8:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.nutrition.eyebrow')}
          title={t.rich('steps.nutrition.title', { accent })}
        >
          <ChoiceList
            choices={nutritionChoices}
            value={draft.nutritionCurrent}
            onChange={(nutritionCurrent) =>
              draft.setAnswer({ nutritionCurrent })
            }
          />
        </StepShell>
      );
    case 9:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.meals.eyebrow')}
          title={t.rich('steps.meals.title', { accent })}
          description={male ? t('steps.meals.descriptionMale') : undefined}
        >
          <ChoiceList
            grid
            choices={male ? maleMealChoices : mealChoices}
            value={draft.mealsPerDay}
            onChange={(mealsPerDay) => draft.setAnswer({ mealsPerDay })}
          />
        </StepShell>
      );
    case 10:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.habits.eyebrow')}
          title={t.rich(
            male ? 'steps.habits.titleMale' : 'steps.habits.titleFemale',
            { accent },
          )}
          description={
            male
              ? t('steps.habits.descriptionMale')
              : t('steps.habits.descriptionFemale')
          }
        >
          <MultiChoiceList
            choices={male ? maleHabitChoices : femaleHabitChoices}
            value={draft.eatingHabits}
            onChange={(eatingHabits) => draft.setAnswer({ eatingHabits })}
          />
        </StepShell>
      );
    case 11:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.metrics.eyebrow')}
          title={t.rich('steps.metrics.title', { accent })}
          description={t('steps.metrics.description')}
          continueLabel={t('steps.metrics.build')}
        >
          <div className="space-y-4">
            <div>
              <MetricField
                id="name"
                label={t('steps.metrics.name')}
                invalid={nameInvalid}
              >
                <input
                  id="name"
                  type="text"
                  autoComplete="given-name"
                  inputMode="text"
                  placeholder={t('steps.metrics.namePlaceholder')}
                  value={draft.name ?? ''}
                  className={metricInputClass}
                  onChange={(event) =>
                    draft.setAnswer({ name: event.target.value })
                  }
                />
              </MetricField>
              {nameInvalid ? (
                <p role="alert" className="mt-2 text-xs text-red-300">
                  {t('errors.name')}
                </p>
              ) : null}
            </div>
            <div>
              <MetricField
                id="dateOfBirth"
                label={t('steps.metrics.dateOfBirth')}
              >
                <input
                  id="dateOfBirth"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={draft.dateOfBirth ?? ''}
                  className={`${metricInputClass} [color-scheme:dark]`}
                  onChange={(event) =>
                    draft.setAnswer({ dateOfBirth: event.target.value })
                  }
                />
              </MetricField>
              {dateImplausible ? (
                <p role="alert" className="mt-2 text-xs text-red-300">
                  {t('errors.dateOfBirth')}
                </p>
              ) : null}
            </div>
            <StepperMetricField
              id="heightCm"
              label={t('steps.metrics.height')}
              unit={t('steps.metrics.heightUnit')}
              value={draft.heightCm}
              min={HEIGHT_CM.min}
              max={HEIGHT_CM.max}
              step={1}
              emptyValue={DEFAULT_HEIGHT_CM}
              placeholder="170"
              decreaseLabel={t('steps.metrics.decrease', {
                field: t('steps.metrics.height'),
              })}
              increaseLabel={t('steps.metrics.increase', {
                field: t('steps.metrics.height'),
              })}
              error={t('errors.height', {
                min: HEIGHT_CM.min,
                max: HEIGHT_CM.max,
              })}
              onChange={(heightCm) => draft.setAnswer({ heightCm })}
            />
            <StepperMetricField
              id="weightKg"
              label={t('steps.metrics.weight')}
              unit={t('steps.metrics.weightUnit')}
              value={draft.weightKg}
              min={WEIGHT_KG.min}
              max={WEIGHT_KG.max}
              step={0.5}
              emptyValue={DEFAULT_WEIGHT_KG}
              placeholder="60"
              decreaseLabel={t('steps.metrics.decrease', {
                field: t('steps.metrics.weight'),
              })}
              increaseLabel={t('steps.metrics.increase', {
                field: t('steps.metrics.weight'),
              })}
              error={t('errors.weight', {
                min: WEIGHT_KG.min,
                max: WEIGHT_KG.max,
              })}
              onChange={(weightKg) => draft.setAnswer({ weightKg })}
            />
            <p className="border border-accent/18 bg-accent/5 px-4 py-3.5 text-[11px] leading-relaxed text-white/55">
              {t('steps.metrics.privacy')}
            </p>
          </div>
        </StepShell>
      );
    default:
      return null;
  }
}

function DraftLoading() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center px-6"
    >
      <div className="h-0.5 w-24 animate-pulse bg-white/30" />
    </main>
  );
}

function Analysis({ className }: { className?: string }) {
  const t = useTranslations('onboarding');
  const steps = t.raw('analysis.steps') as string[];
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepDuration = 360;
    const timers = steps.map((_, index) =>
      window.setTimeout(() => setCurrentStep(index), index * stepDuration),
    );
    const interval = window.setInterval(() => {
      setProgress((value) => (value >= 100 ? 100 : value + 2.2));
    }, 40);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
    };
  }, [steps]);

  return (
    <main
      className={cn(
        'relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center border-x border-white/5 bg-[#0b0b0b] px-8 text-center',
        className,
      )}
    >
      <div className="pointer-events-none absolute top-[30%] left-1/2 size-[19rem] -translate-x-1/2 rounded-full bg-accent/6 blur-3xl" />
      <div className="absolute top-8 right-6">
        <LocaleSwitcher />
      </div>
      <div className="relative w-full max-w-80">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <h1 className="mt-12 font-heading text-[32px] font-normal uppercase leading-9 tracking-[-0.02em]">
          {t.rich('analysis.title', { accent })}
        </h1>
        <div className="mx-auto my-4 h-px w-15 bg-accent" />
        <p className="mx-auto mb-12 max-w-[17.5rem] text-xs leading-[1.65] text-white/55">
          {t('analysis.subtitle')}
        </p>
        <div className="mb-9">
          <div className="relative h-0.5 w-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 bg-accent shadow-[0_0_12px_color-mix(in_srgb,var(--accent)_60%,transparent)] transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-label text-[9px] tracking-[0.1em] uppercase">
            <span className="text-white/30">{t('analysis.label')}</span>
            <span className="font-semibold text-accent">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 text-left">
          {steps.map((step, index) => {
            const done = index < currentStep;
            const active = index === currentStep;
            return (
              <div
                key={step}
                className={cn(
                  'flex items-center gap-3 transition-opacity duration-300',
                  index > currentStep ? 'opacity-20' : 'opacity-100',
                )}
              >
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border',
                    done || active ? 'border-accent' : 'border-white/20',
                    done && 'bg-accent',
                  )}
                >
                  {done ? (
                    <Check
                      size={9}
                      strokeWidth={3}
                      className="text-[#0b0b0b]"
                    />
                  ) : active ? (
                    <span className="size-1.5 rounded-full bg-accent" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-xs',
                    done && 'text-white/50',
                    active && 'text-white',
                    !done && !active && 'text-white/30',
                  )}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function mainGoalLabel(
  t: ReturnType<typeof useTranslations<'onboarding'>>,
  mainGoal: string | undefined,
  male: boolean,
) {
  switch (mainGoal) {
    case 'lose_weight':
      return t('choices.mainGoal.lose_weight');
    case 'build_muscle':
      return t('choices.mainGoal.build_muscle');
    case 'improve_body':
      return t('choices.mainGoal.improve_body');
    case 'maintain':
      return t('choices.mainGoal.maintain');
    case 'get_stronger':
      return male
        ? t('choices.mainGoal.get_stronger_male')
        : t('choices.mainGoal.get_stronger_female');
    default:
      return '—';
  }
}

function experienceLabelFor(
  t: ReturnType<typeof useTranslations<'onboarding'>>,
  experience: string | undefined,
  male: boolean,
) {
  switch (experience) {
    case 'beginner':
      return t('choices.experience.beginner.label');
    case 'intermediate':
      return t('choices.experience.intermediate.label');
    case 'advanced':
      return male
        ? t('choices.experience.advanced_male')
        : t('choices.experience.advanced_female');
    default:
      return '—';
  }
}

function focusAreaLabel(
  t: ReturnType<typeof useTranslations<'onboarding'>>,
  area: string,
) {
  switch (area) {
    case 'glutes':
      return t('choices.focus.glutes');
    case 'legs':
      return t('choices.focus.legs');
    case 'shoulders':
      return t('choices.focus.shoulders');
    case 'back':
      return t('choices.focus.back');
    case 'arms':
      return t('choices.focus.arms');
    case 'abs':
      return t('choices.focus.abs');
    case 'full_body':
      return t('choices.focus.full_body');
    case 'chest':
      return t('choices.focus.chest');
    default:
      return area;
  }
}

function focusAreasLabel(
  t: ReturnType<typeof useTranslations<'onboarding'>>,
  areas: string[],
) {
  return areas.map((area) => focusAreaLabel(t, area)).join(', ');
}

function Plan({
  draft,
  onContinue,
  className,
}: {
  draft: OnboardingState;
  onContinue: () => void;
  className?: string;
}) {
  const t = useTranslations('onboarding');
  const programId = previewProgramId(draft);
  const includes = t.raw(`plan.preview.${programId}.includes`) as string[];
  const male = draft.programTrack === 'male';
  const focusLabel =
    focusAreasLabel(t, draft.focusAreas) || t('choices.focus.full_body');
  const rows = [
    [t('result.mainGoal'), mainGoalLabel(t, draft.mainGoal, male)],
    [t('plan.level'), experienceLabelFor(t, draft.experience, male)],
    [
      t('plan.frequency'),
      t('plan.frequencyValue', { count: draft.trainingFrequency ?? '3' }),
    ],
    [t('plan.focus'), focusLabel],
  ];

  return (
    <SummaryScreen
      eyebrow={t('plan.eyebrow')}
      title={t.rich('plan.title', { accent })}
      onContinue={onContinue}
      button={t('plan.button')}
      className={className}
    >
      <article className="mb-4 overflow-hidden border border-accent/30 bg-white/2">
        <div className="relative border-b border-accent/15 bg-accent/8 px-[18px] pt-[18px] pb-4">
          <div className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
          <div className="flex items-start justify-between gap-2.5">
            <div>
              <p className="font-label text-xl font-bold tracking-wide text-accent">
                {t(`plan.preview.${programId}.name`)}
              </p>
            </div>
            <span className="shrink-0 bg-accent px-2.5 py-1 font-label text-[8px] font-bold tracking-[0.12em] text-[#0b0b0b] uppercase">
              {t('plan.forYou')}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3.5 px-[18px] py-4">
          <p className="text-xs leading-5 text-white/60">{t('plan.intro')}</p>
          <div>
            {rows.map(([label, value], index) => (
              <div
                key={label}
                className={cn(
                  'flex items-start justify-between gap-3',
                  index < rows.length - 1 &&
                    'mb-3.5 border-b border-white/7 pb-3.5',
                )}
              >
                <span className="shrink-0 font-label text-[9px] font-semibold tracking-[0.12em] text-white/35 uppercase">
                  {label}
                </span>
                <span className="text-right text-xs font-semibold text-white">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-white/7" />
          <p className="text-xs leading-6 text-white/60">
            {t(`plan.preview.${programId}.description`)}
          </p>
          <div>
            <p className="mb-2.5 font-label text-[9px] font-semibold tracking-[0.14em] text-accent uppercase">
              {t('plan.includes')}
            </p>
            <ul className="flex flex-col gap-2">
              {includes.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/12">
                    <Check size={8} strokeWidth={3} className="text-accent" />
                  </span>
                  <span className="text-xs text-white/65">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </SummaryScreen>
  );
}

function SummaryScreen({
  eyebrow,
  title,
  description,
  children,
  onContinue,
  button,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  onContinue: () => void;
  button: string;
  className?: string;
}) {
  return (
    <main
      className={cn(
        'relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden border-x border-white/5 bg-[#0b0b0b] px-5 pb-10 pt-4',
        className,
      )}
    >
      <div className="pointer-events-none absolute top-[15%] right-[-60px] size-[14rem] rounded-full bg-accent/7 blur-3xl" />
      <header className="relative flex items-center justify-between pb-3">
        <BrandMark />
        <LocaleSwitcher />
      </header>
      <div className="h-px bg-white/8" />
      <p className="relative mt-7 font-label text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
        {eyebrow}
      </p>
      <h1 className="relative mt-2.5 font-heading text-[32px] font-normal uppercase leading-9 tracking-[-0.02em]">
        {title}
      </h1>
      <div className="relative my-2.5 h-px w-15 bg-accent" />
      {description ? (
        <p className="relative mb-5 text-[11px] leading-5 text-[#d9d9d9]">
          {description}
        </p>
      ) : null}
      <div className="relative flex-1">{children}</div>
      <Button className="relative mt-8 w-full" onClick={onContinue}>
        {button}
      </Button>
    </main>
  );
}
