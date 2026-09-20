'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { onboardingSchema } from '@repo/validation';
import { CheckCircle2, Dumbbell, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { getUserFacingError } from '@/lib/api/errors';
import { useSaveOnboarding } from '@/lib/hooks/use-users';
import { readSelectedPlanId } from '@/lib/subscriptions/selected-plan';
import { ChoiceList, MultiChoiceList, type Choice } from './choice-list';
import { useOnboardingStore, type OnboardingState } from './onboarding-store';
import { buildOnboardingPayload } from './payload';
import { StepShell } from './step-shell';

const FEMALE_CURRENT_PHOTOS = [
  ['slim', 'photo-1531520563951-4c0e3d3fcacc'],
  ['toned', 'photo-1606902965551-dce093cda6e7'],
  ['athletic', 'photo-1538240175502-ec4eb4455f34'],
  ['defined', 'photo-1574680088814-c9e8a10d8a4d'],
  ['full', 'photo-1541534741688-6078c6bfb5c5'],
] as const;

const FEMALE_DESIRED_IMAGES = [
  'photo-1531520563951-4c0e3d3fcacc',
  'photo-1606902965551-dce093cda6e7',
  'photo-1538240175502-ec4eb4455f34',
  'photo-1574680088814-c9e8a10d8a4d',
  'photo-1534367610401-9f5ed68180aa',
];

const MALE_CURRENT_IMAGES = [
  'photo-1613702973353-a854c7dc7a3b',
  'photo-1614396648745-d5de9c9e037e',
  'photo-1532384816664-01b8b7238c8d',
  'photo-1578924608828-79a71150f711',
  'photo-1610312856669-2cee66b2949c',
];

const MALE_DESIRED_IMAGES = [
  'photo-1614396648745-d5de9c9e037e',
  'photo-1532384816664-01b8b7238c8d',
  'photo-1578924608828-79a71150f711',
  'photo-1672866332205-9246ee75ca14',
  'photo-1621750627159-cf77b0b91aac',
];

const TOTAL_STEPS = 14;

function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) return null;
  const born = new Date(`${dateOfBirth}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  ) {
    age -= 1;
  }
  return age;
}

function accent(chunks: ReactNode) {
  return <span className="text-accent">{chunks}</span>;
}

export function OnboardingWizard() {
  const router = useRouter();
  const draft = useOnboardingStore();
  const saveOnboarding = useSaveOnboarding();
  const t = useTranslations('onboarding');
  const tAuth = useTranslations('auth');
  const [phase, setPhase] = useState<'wizard' | 'analysis' | 'result' | 'plan'>(
    'wizard',
  );

  const male = draft.programTrack === 'male';
  const age = calculateAge(draft.dateOfBirth);
  const currentBodyChoices = useMemo(() => {
    if (!male) {
      return FEMALE_CURRENT_PHOTOS.map(([value, photo], index) => ({
        value,
        label: t('variant', { index: index + 1 }),
        image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=600&q=80`,
      }));
    }
    return MALE_CURRENT_IMAGES.map((photo, index) => ({
      value: String(index),
      label: t('variant', { index: index + 1 }),
      image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=600&q=80`,
    }));
  }, [male, t]);
  const desiredBodyChoices = useMemo(
    () =>
      (male ? MALE_DESIRED_IMAGES : FEMALE_DESIRED_IMAGES).map(
        (photo, index) => ({
          value: String(index),
          label: t('variant', { index: index + 1 }),
          image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=600&q=80`,
        }),
      ),
    [male, t],
  );

  const mainGoalChoices: Choice[] = [
    { value: 'lose_weight', label: t('choices.mainGoal.lose_weight') },
    { value: 'build_muscle', label: t('choices.mainGoal.build_muscle') },
    { value: 'improve_body', label: t('choices.mainGoal.improve_body') },
    { value: 'maintain', label: t('choices.mainGoal.maintain') },
    {
      value: 'get_stronger',
      label: male
        ? t('choices.mainGoal.get_stronger_male')
        : t('choices.mainGoal.get_stronger_female'),
    },
  ];

  const weightGoalChoices: Choice[] = [
    {
      value: 'LOSE_WEIGHT',
      label: t('choices.weightGoal.LOSE_WEIGHT.label'),
      description: t('choices.weightGoal.LOSE_WEIGHT.description'),
    },
    {
      value: 'MAINTAIN_WEIGHT',
      label: t('choices.weightGoal.MAINTAIN_WEIGHT.label'),
      description: t('choices.weightGoal.MAINTAIN_WEIGHT.description'),
    },
    {
      value: 'GAIN_WEIGHT',
      label: t('choices.weightGoal.GAIN_WEIGHT.label'),
      description: t('choices.weightGoal.GAIN_WEIGHT.description'),
    },
  ];

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

  const activityChoices: Choice[] = [
    {
      value: 'SEDENTARY',
      label: t('choices.activity.SEDENTARY.label'),
      description: t('choices.activity.SEDENTARY.description'),
    },
    {
      value: 'LIGHTLY_ACTIVE',
      label: t('choices.activity.LIGHTLY_ACTIVE.label'),
      description: t('choices.activity.LIGHTLY_ACTIVE.description'),
    },
    {
      value: 'MODERATELY_ACTIVE',
      label: t('choices.activity.MODERATELY_ACTIVE.label'),
      description: t('choices.activity.MODERATELY_ACTIVE.description'),
    },
    {
      value: 'VERY_ACTIVE',
      label: t('choices.activity.VERY_ACTIVE.label'),
      description: t('choices.activity.VERY_ACTIVE.description'),
    },
    {
      value: 'EXTRA_ACTIVE',
      label: t('choices.activity.EXTRA_ACTIVE.label'),
      description: t('choices.activity.EXTRA_ACTIVE.description'),
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
    const timer = window.setTimeout(() => setPhase('result'), 1800);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function previous() {
    if (draft.step === 0) {
      router.push('/');
      return;
    }
    draft.setStep(draft.step - 1);
  }

  async function next() {
    if (!isCurrentStepValid()) return;
    if (draft.step < TOTAL_STEPS - 1) {
      draft.setStep(draft.step + 1);
      return;
    }

    try {
      await saveOnboarding.mutateAsync(buildOnboardingPayload(draft));
      setPhase('analysis');
    } catch {
      // The mutation error is rendered without clearing the persisted draft.
    }
  }

  function isCurrentStepValid() {
    switch (draft.step) {
      case 0:
        return Boolean(draft.programTrack);
      case 1:
        return Boolean(draft.currentBody);
      case 2:
        return Boolean(draft.desiredBody);
      case 3:
        return Boolean(draft.mainGoal);
      case 4:
        return onboardingSchema
          .pick({ goal: true })
          .safeParse({ goal: draft.goal }).success;
      case 5:
        return Boolean(draft.experience);
      case 6:
        return Boolean(draft.trainingFrequency);
      case 7:
        return onboardingSchema
          .pick({ activityLevel: true })
          .safeParse({ activityLevel: draft.activityLevel }).success;
      case 8:
        return draft.focusAreas.length > 0;
      case 9:
        return Boolean(draft.nutritionCurrent);
      case 10:
        return Boolean(draft.mealsPerDay);
      case 11:
        return draft.eatingHabits.length > 0;
      case 12:
        return onboardingSchema
          .pick({ dateOfBirth: true, heightCm: true, weightKg: true })
          .safeParse({
            dateOfBirth: draft.dateOfBirth,
            heightCm: draft.heightCm,
            weightKg: draft.weightKg,
          }).success;
      case 13:
        return onboardingSchema
          .pick({ biologicalSexForCalculation: true })
          .safeParse({
            biologicalSexForCalculation: draft.biologicalSexForCalculation,
          }).success;
      default:
        return false;
    }
  }

  if (phase === 'analysis') return <Analysis />;
  if (phase === 'result') {
    return (
      <Result age={age} draft={draft} onContinue={() => setPhase('plan')} />
    );
  }
  if (phase === 'plan') {
    return (
      <Plan
        draft={draft}
        onContinue={() => {
          draft.reset();
          const planId = readSelectedPlanId();
          router.replace(planId ? `/checkout?planId=${planId}` : '/dashboard');
        }}
      />
    );
  }

  const common = {
    step: draft.step,
    total: TOTAL_STEPS,
    onBack: previous,
    onContinue: () => void next(),
    canContinue: isCurrentStepValid(),
    pending: saveOnboarding.isPending,
    error: saveOnboarding.error
      ? getUserFacingError(saveOnboarding.error, tAuth)
      : null,
  };

  switch (draft.step) {
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
            onChange={(value) =>
              draft.setAnswer({
                programTrack: value as 'female' | 'male',
              })
            }
            choices={[
              {
                value: 'female',
                label: t('choices.program.female.label'),
                description: t('choices.program.female.description'),
                image:
                  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
              },
              {
                value: 'male',
                label: t('choices.program.male.label'),
                description: t('choices.program.male.description'),
                image:
                  'https://images.unsplash.com/photo-1578924608828-79a71150f711?auto=format&fit=crop&w=800&q=80',
              },
            ]}
          />
        </StepShell>
      );
    case 1:
    case 2: {
      const current = draft.step === 1;
      return (
        <StepShell
          {...common}
          eyebrow={
            current
              ? t('steps.currentBody.eyebrow')
              : t('steps.desiredBody.eyebrow')
          }
          title={t.rich(
            current ? 'steps.currentBody.title' : 'steps.desiredBody.title',
            { accent },
          )}
          description={
            current
              ? t('steps.currentBody.description')
              : t('steps.desiredBody.description')
          }
        >
          <ChoiceList
            grid
            imageGrid
            choices={current ? currentBodyChoices : desiredBodyChoices}
            value={current ? draft.currentBody : draft.desiredBody}
            onChange={(value) =>
              draft.setAnswer(
                current ? { currentBody: value } : { desiredBody: value },
              )
            }
          />
        </StepShell>
      );
    }
    case 3:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.mainGoal.eyebrow')}
          title={t.rich('steps.mainGoal.title', { accent })}
        >
          <ChoiceList
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
          eyebrow={t('steps.weightGoal.eyebrow')}
          title={t.rich('steps.weightGoal.title', { accent })}
          description={t('steps.weightGoal.description')}
        >
          <ChoiceList
            choices={weightGoalChoices}
            value={draft.goal}
            onChange={(goal) =>
              draft.setAnswer({
                goal: goal as 'LOSE_WEIGHT' | 'MAINTAIN_WEIGHT' | 'GAIN_WEIGHT',
              })
            }
          />
        </StepShell>
      );
    case 5:
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
    case 6:
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
    case 7:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.activity.eyebrow')}
          title={t.rich('steps.activity.title', { accent })}
          description={t('steps.activity.description')}
        >
          <ChoiceList
            choices={activityChoices}
            value={draft.activityLevel}
            onChange={(activityLevel) =>
              draft.setAnswer({
                activityLevel: activityLevel as
                  | 'SEDENTARY'
                  | 'LIGHTLY_ACTIVE'
                  | 'MODERATELY_ACTIVE'
                  | 'VERY_ACTIVE'
                  | 'EXTRA_ACTIVE',
              })
            }
          />
        </StepShell>
      );
    case 8:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.focus.eyebrow')}
          title={t.rich('steps.focus.title', { accent })}
          description={t('steps.focus.description')}
        >
          <MultiChoiceList
            choices={male ? maleFocus : femaleFocus}
            value={draft.focusAreas}
            onChange={(focusAreas) => draft.setAnswer({ focusAreas })}
          />
        </StepShell>
      );
    case 9:
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
    case 10:
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
    case 11:
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
    case 12:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.metrics.eyebrow')}
          title={t.rich('steps.metrics.title', { accent })}
          description={
            age === null
              ? t('steps.metrics.unitsNote')
              : t('steps.metrics.ageNote', { age })
          }
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">
                {t('steps.metrics.dateOfBirth')}
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={draft.dateOfBirth ?? ''}
                onChange={(event) =>
                  draft.setAnswer({ dateOfBirth: event.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heightCm">{t('steps.metrics.height')}</Label>
                <Input
                  id="heightCm"
                  type="number"
                  inputMode="decimal"
                  min={80}
                  max={250}
                  value={draft.heightCm ?? ''}
                  onChange={(event) =>
                    draft.setAnswer({
                      heightCm: event.target.value
                        ? event.target.valueAsNumber
                        : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weightKg">{t('steps.metrics.weight')}</Label>
                <Input
                  id="weightKg"
                  type="number"
                  inputMode="decimal"
                  min={25}
                  max={500}
                  step="0.1"
                  value={draft.weightKg ?? ''}
                  onChange={(event) =>
                    draft.setAnswer({
                      weightKg: event.target.value
                        ? event.target.valueAsNumber
                        : undefined,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </StepShell>
      );
    default:
      return (
        <StepShell
          {...common}
          eyebrow={t('steps.bmr.eyebrow')}
          title={t.rich('steps.bmr.title', { accent })}
          description={t('steps.bmr.description')}
        >
          <ChoiceList
            choices={[
              { value: 'FEMALE', label: t('choices.bmr.FEMALE') },
              { value: 'MALE', label: t('choices.bmr.MALE') },
            ]}
            value={draft.biologicalSexForCalculation}
            onChange={(biologicalSexForCalculation) =>
              draft.setAnswer({
                biologicalSexForCalculation: biologicalSexForCalculation as
                  'FEMALE' | 'MALE',
              })
            }
          />
        </StepShell>
      );
  }
}

function Analysis() {
  const t = useTranslations('onboarding');

  return (
    <main className="relative mx-auto grid min-h-screen w-full max-w-md place-items-center border-x border-white/5 px-8 text-center">
      <div className="absolute top-8 right-6">
        <LocaleSwitcher />
      </div>
      <div>
        <Sparkles
          className="mx-auto mb-7 animate-pulse text-accent"
          size={42}
        />
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
          {t('analysis.eyebrow')}
        </p>
        <h1 className="mt-4 font-heading text-4xl uppercase leading-tight">
          {t.rich('analysis.title', { accent })}
        </h1>
        <div className="mx-auto mt-8 h-1 w-48 overflow-hidden bg-line">
          <div className="h-full w-2/3 animate-pulse bg-accent" />
        </div>
      </div>
    </main>
  );
}

function Result({
  age,
  draft,
  onContinue,
}: {
  age: number | null;
  draft: OnboardingState;
  onContinue: () => void;
}) {
  const t = useTranslations('onboarding');

  return (
    <SummaryScreen
      eyebrow={t('result.eyebrow')}
      title={t.rich('result.title', { accent })}
      icon={<CheckCircle2 size={38} />}
      onContinue={onContinue}
      button={t('result.button')}
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          [t('result.age'), age ?? '—'],
          [
            t('result.height'),
            t('result.heightValue', { value: draft.heightCm ?? '—' }),
          ],
          [
            t('result.weight'),
            t('result.weightValue', { value: draft.weightKg ?? '—' }),
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border border-line bg-panel p-3 text-center"
          >
            <strong className="block font-heading text-xl text-accent">
              {value}
            </strong>
            <span className="text-[9px] uppercase tracking-wider text-muted">
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs leading-6 text-muted">{t('result.note')}</p>
    </SummaryScreen>
  );
}

function Plan({
  draft,
  onContinue,
}: {
  draft: OnboardingState;
  onContinue: () => void;
}) {
  const t = useTranslations('onboarding');

  return (
    <SummaryScreen
      eyebrow={t('plan.eyebrow')}
      title={t.rich('plan.title', { accent })}
      icon={<Dumbbell size={38} />}
      onContinue={onContinue}
      button={t('plan.button')}
    >
      <div className="space-y-3">
        <PlanRow
          label={t('plan.training')}
          value={t('plan.trainingValue', {
            count: draft.trainingFrequency ?? '3',
          })}
        />
        <PlanRow
          label={t('plan.level')}
          value={draft.experience ?? t('plan.levelFallback')}
        />
        <PlanRow
          label={t('plan.focus')}
          value={
            draft.focusAreas.includes('full_body')
              ? t('plan.focusFullBody')
              : t('plan.focusZones', { count: draft.focusAreas.length })
          }
        />
      </div>
      <p className="mt-5 border-l-2 border-accent/50 pl-3 text-[10px] leading-5 text-muted">
        {t('plan.disclaimer')}
      </p>
    </SummaryScreen>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-3">
      <span className="font-label text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <strong className="text-sm text-ink">{value}</strong>
    </div>
  );
}

function SummaryScreen({
  eyebrow,
  title,
  icon,
  children,
  onContinue,
  button,
}: {
  eyebrow: string;
  title: React.ReactNode;
  icon: React.ReactNode;
  children: React.ReactNode;
  onContinue: () => void;
  button: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-white/5 px-6 pb-10 pt-8">
      <header className="flex items-center justify-between">
        <BrandMark />
        <LocaleSwitcher />
      </header>
      <div className="mt-16 text-accent">{icon}</div>
      <p className="mt-5 font-label text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-heading text-4xl uppercase leading-tight">
        {title}
      </h1>
      <div className="my-6 h-px w-16 bg-accent" />
      <div className="flex-1">{children}</div>
      <Button className="mt-8 w-full" onClick={onContinue}>
        {button}
      </Button>
    </main>
  );
}
