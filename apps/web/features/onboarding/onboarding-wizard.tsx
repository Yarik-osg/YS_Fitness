'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingSchema } from '@repo/validation';
import { CheckCircle2, Dumbbell, Sparkles } from 'lucide-react';
import { BrandMark } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getUserFacingError } from '@/lib/api/errors';
import { useSaveOnboarding } from '@/lib/hooks/use-users';
import { ChoiceList, MultiChoiceList, type Choice } from './choice-list';
import { useOnboardingStore, type OnboardingState } from './onboarding-store';
import { buildOnboardingPayload } from './payload';
import { StepShell } from './step-shell';

const FEMALE_CURRENT_BODY: Choice[] = (
  [
    ['slim', 'photo-1531520563951-4c0e3d3fcacc'],
    ['toned', 'photo-1606902965551-dce093cda6e7'],
    ['athletic', 'photo-1538240175502-ec4eb4455f34'],
    ['defined', 'photo-1574680088814-c9e8a10d8a4d'],
    ['full', 'photo-1541534741688-6078c6bfb5c5'],
  ] as const
).map(([value, photo], index) => ({
  value,
  label: `Варіант ${index + 1}`,
  image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=600&q=80`,
}));

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

const sharedMainGoalChoices: Choice[] = [
  { value: 'lose_weight', label: 'Схуднути' },
  { value: 'build_muscle', label: "Набрати м'язову масу" },
  { value: 'improve_body', label: 'Покращити якість тіла' },
  { value: 'maintain', label: 'Зберегти форму' },
];

function mainGoalChoices(male: boolean): Choice[] {
  return [
    ...sharedMainGoalChoices,
    {
      value: 'get_stronger',
      label: male ? 'Стати сильнішим' : 'Стати сильнішою',
    },
  ];
}

const weightGoalChoices: Choice[] = [
  {
    value: 'LOSE_WEIGHT',
    label: 'Знизити вагу',
    description: 'Дефіцит калорій',
  },
  {
    value: 'MAINTAIN_WEIGHT',
    label: 'Утримувати вагу',
    description: 'Баланс калорій',
  },
  {
    value: 'GAIN_WEIGHT',
    label: 'Збільшити вагу',
    description: 'Профіцит калорій',
  },
];

const sharedExperienceChoices: Choice[] = [
  {
    value: 'beginner',
    label: 'Початківець',
    description: 'Менше 6 місяців або тільки починаю',
  },
  {
    value: 'intermediate',
    label: 'Середній рівень',
    description: 'Регулярно тренуюсь 6–24 місяці',
  },
];

function experienceChoices(male: boolean): Choice[] {
  return [
    ...sharedExperienceChoices,
    {
      value: 'advanced',
      label: male ? 'Досвідчений' : 'Досвідчена',
      description: 'Системно тренуюсь понад 2 роки',
    },
  ];
}

const frequencyChoices: Choice[] = [
  { value: '2', label: '2 рази', description: 'Оптимально для початку' },
  { value: '3', label: '3 рази', description: 'Збалансований темп' },
  { value: '4', label: '4 рази', description: 'Інтенсивний прогрес' },
];

const activityChoices: Choice[] = [
  {
    value: 'SEDENTARY',
    label: 'Мінімальна',
    description: 'Переважно сидячий день',
  },
  {
    value: 'LIGHTLY_ACTIVE',
    label: 'Легка',
    description: 'Легка активність 1–3 дні на тиждень',
  },
  {
    value: 'MODERATELY_ACTIVE',
    label: 'Помірна',
    description: 'Активність 3–5 днів на тиждень',
  },
  {
    value: 'VERY_ACTIVE',
    label: 'Висока',
    description: 'Інтенсивна активність 6–7 днів',
  },
  {
    value: 'EXTRA_ACTIVE',
    label: 'Дуже висока',
    description: 'Фізична робота або подвійні тренування',
  },
];

const femaleFocus: Choice[] = [
  { value: 'glutes', label: 'Сідниці' },
  { value: 'legs', label: 'Ноги' },
  { value: 'shoulders', label: 'Плечі' },
  { value: 'back', label: 'Спина' },
  { value: 'arms', label: 'Руки' },
  { value: 'abs', label: 'Прес' },
  { value: 'full_body', label: 'Рівномірний розвиток усього тіла' },
];

const maleFocus: Choice[] = [
  { value: 'chest', label: 'Груди' },
  ...femaleFocus,
];

const nutritionChoices: Choice[] = [
  { value: 'structured', label: 'Харчуюсь за планом / рахую калорії' },
  {
    value: 'balanced',
    label: 'Намагаюсь харчуватись збалансовано, але без підрахунків',
  },
  { value: 'intuitive', label: 'Харчуюсь інтуїтивно' },
  { value: 'irregular', label: 'Харчування нерегулярне' },
  { value: 'uncontrolled', label: 'Не контролюю харчування' },
];

const mealChoices: Choice[] = [
  { value: '1-2', label: '1–2', description: 'Рідкісні прийоми їжі' },
  { value: '3', label: '3', description: 'Класичний режим' },
  { value: '4', label: '4', description: 'Часте харчування' },
  { value: '5+', label: '5+', description: 'Дрібні порції, часто' },
  { value: 'no_schedule', label: '~', description: 'Немає режиму' },
];

const maleMealChoices: Choice[] = [
  { value: '1-2', label: '1–2 рази', description: 'Мало їм протягом дня' },
  { value: '3', label: '3 рази', description: 'Сніданок, обід, вечеря' },
  {
    value: '4-5',
    label: '4–5 разів',
    description: 'Із перекусами між прийомами',
  },
  { value: '6+', label: '6+ разів', description: 'Їм дуже часто' },
  {
    value: 'varies',
    label: 'По-різному',
    description: 'Нестабільний режим харчування',
  },
];

const femaleHabitChoices: Choice[] = [
  { value: 'evening_overeating', label: 'Переїдання ввечері' },
  { value: 'snacking', label: 'Часті перекуси' },
  { value: 'sweet_cravings', label: 'Тяга до солодкого' },
  { value: 'fastfood', label: 'Фастфуд / доставка' },
  { value: 'skipping_meals', label: 'Пропускаю прийоми їжі' },
  { value: 'portions', label: 'Важко контролювати порції' },
  { value: 'emotional', label: 'Харчування залежить від настрою' },
  { value: 'none', label: 'Нічого з переліченого' },
];

const maleHabitChoices: Choice[] = [
  { value: 'late_eating', label: 'Їм пізно ввечері або вночі' },
  { value: 'skipping', label: 'Пропускаю прийоми їжі' },
  { value: 'emotional', label: 'Іноді їм через стрес або нудьгу' },
  { value: 'fast_food', label: 'Часто їм фастфуд або напівфабрикати' },
  { value: 'sweets', label: 'Важко відмовитись від солодкого' },
  { value: 'overeating', label: 'Схильний до переїдання' },
  { value: 'irregular', label: 'Їм нерегулярно' },
  { value: 'none', label: 'Нічого з переліченого' },
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

export function OnboardingWizard() {
  const router = useRouter();
  const draft = useOnboardingStore();
  const saveOnboarding = useSaveOnboarding();
  const [phase, setPhase] = useState<'wizard' | 'analysis' | 'result' | 'plan'>(
    'wizard',
  );

  const male = draft.programTrack === 'male';
  const age = calculateAge(draft.dateOfBirth);
  const currentBodyChoices = useMemo(() => {
    if (!male) return FEMALE_CURRENT_BODY;
    return MALE_CURRENT_IMAGES.map((photo, index) => ({
      value: String(index),
      label: `Варіант ${index + 1}`,
      image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=600&q=80`,
    }));
  }, [male]);
  const desiredBodyChoices = useMemo(
    () =>
      (male ? MALE_DESIRED_IMAGES : FEMALE_DESIRED_IMAGES).map(
        (photo, index) => ({
          value: String(index),
          label: `Варіант ${index + 1}`,
          image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=600&q=80`,
        }),
      ),
    [male],
  );

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
          router.replace('/dashboard');
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
      ? getUserFacingError(saveOnboarding.error)
      : null,
  };

  switch (draft.step) {
    case 0:
      return (
        <StepShell
          {...common}
          eyebrow="Вибір програми"
          title={
            <>
              Обери свій <span className="text-accent">напрямок</span>
            </>
          }
          description="Цей вибір змінює візуальну мову та акценти програми. Для розрахунку BMR буде окреме питання."
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
                label: 'Для жінок',
                description: 'Жіноча програма',
                image:
                  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
              },
              {
                value: 'male',
                label: 'Для чоловіків',
                description: 'Чоловіча програма',
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
          eyebrow={current ? 'Поточна форма' : 'Бажана форма'}
          title={
            current ? (
              <>
                Яка твоя <span className="text-accent">форма зараз?</span>
              </>
            ) : (
              <>
                Якої форми ти{' '}
                <span className="text-accent">хочеш досягти?</span>
              </>
            )
          }
          description="Обери фото, яке найбільше відповідає твоїй відповіді."
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
          eyebrow="Головна мета"
          title={
            <>
              Яка твоя <span className="text-accent">головна мета?</span>
            </>
          }
        >
          <ChoiceList
            choices={mainGoalChoices(male)}
            value={draft.mainGoal}
            onChange={(mainGoal) => draft.setAnswer({ mainGoal })}
          />
        </StepShell>
      );
    case 4:
      return (
        <StepShell
          {...common}
          eyebrow="Ціль ваги"
          title={
            <>
              Як має змінитися <span className="text-accent">твоя вага?</span>
            </>
          }
          description="Це окремий параметр для майбутнього розрахунку калорій."
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
          eyebrow="Рівень підготовки"
          title={
            <>
              Який у тебе <span className="text-accent">досвід тренувань?</span>
            </>
          }
        >
          <ChoiceList
            choices={experienceChoices(male)}
            value={draft.experience}
            onChange={(experience) => draft.setAnswer({ experience })}
          />
        </StepShell>
      );
    case 6:
      return (
        <StepShell
          {...common}
          eyebrow="Частота тренувань"
          title={
            <>
              Скільки разів на тиждень ти{' '}
              <span className="text-accent">
                {male ? 'готовий тренуватися?' : 'готова тренуватися?'}
              </span>
            </>
          }
          description="Обери реалістичну кількість тренувань, яку зможеш підтримувати."
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
          eyebrow="Щоденна активність"
          title={
            <>
              Наскільки ти <span className="text-accent">активні щодня?</span>
            </>
          }
          description="Не враховуй заплановані тренування — оцінюй звичайний день."
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
          eyebrow="Акцент тренувань"
          title={
            <>
              На чому ти хочеш{' '}
              <span className="text-accent">зробити акцент?</span>
            </>
          }
          description="Можна обрати декілька варіантів."
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
          eyebrow="Харчування зараз"
          title={
            <>
              Як ти <span className="text-accent">харчуєшся зараз?</span>
            </>
          }
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
          eyebrow="Режим харчування"
          title={
            <>
              Скільки разів на день ти{' '}
              <span className="text-accent">зазвичай їси?</span>
            </>
          }
          description={
            male ? 'Обери варіант, що найбільше підходить.' : undefined
          }
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
          eyebrow="Харчові звички"
          title={
            male ? (
              <>
                Які звички <span className="text-accent">ти маєш?</span>
              </>
            ) : (
              <>
                Що найбільше{' '}
                <span className="text-accent">заважає харчуванню?</span>
              </>
            )
          }
          description={
            male
              ? 'Обери всі варіанти, що підходять.'
              : 'Можна обрати декілька варіантів.'
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
          eyebrow="Особисті дані"
          title={
            <>
              Розкажи про <span className="text-accent">своє тіло</span>
            </>
          }
          description={
            age === null
              ? 'Використовуємо лише метричні одиниці.'
              : `Розрахований вік: ${age}`
          }
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Дата народження</Label>
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
                <Label htmlFor="heightCm">Зріст, см</Label>
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
                <Label htmlFor="weightKg">Вага, кг</Label>
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
          eyebrow="Розрахунок енергії"
          title={
            <>
              Обери параметр для{' '}
              <span className="text-accent">формули BMR</span>
            </>
          }
          description="Це окреме біологічне значення використовується лише у формулі Mifflin–St Jeor і не змінює обраний напрямок програми."
        >
          <ChoiceList
            choices={[
              { value: 'FEMALE', label: 'Жіноча формула' },
              { value: 'MALE', label: 'Чоловіча формула' },
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
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center border-x border-white/5 px-8 text-center">
      <div>
        <Sparkles
          className="mx-auto mb-7 animate-pulse text-accent"
          size={42}
        />
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
          Аналіз відповідей
        </p>
        <h1 className="mt-4 font-heading text-4xl uppercase leading-tight">
          Формуємо твою <span className="text-accent">персональну основу</span>
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
  return (
    <SummaryScreen
      eyebrow="Персональний результат"
      title={
        <>
          Твоя база <span className="text-accent">готова</span>
        </>
      }
      icon={<CheckCircle2 size={38} />}
      onContinue={onContinue}
      button="Переглянути план →"
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Вік', age ?? '—'],
          ['Зріст', `${draft.heightCm} см`],
          ['Вага', `${draft.weightKg} кг`],
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
      <p className="mt-5 text-xs leading-6 text-muted">
        Профіль збережено. Розрахунок калорій і макросів з’явиться в окремому
        модулі харчування — ми не підміняємо його статичними значеннями.
      </p>
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
  return (
    <SummaryScreen
      eyebrow="Рекомендований план"
      title={
        <>
          Твій ритм. <span className="text-accent">Твій прогрес.</span>
        </>
      }
      icon={<Dumbbell size={38} />}
      onContinue={onContinue}
      button="Перейти в кабінет →"
    >
      <div className="space-y-3">
        <PlanRow
          label="Тренування"
          value={`${draft.trainingFrequency ?? '3'} рази на тиждень`}
        />
        <PlanRow label="Рівень" value={draft.experience ?? 'Персональний'} />
        <PlanRow
          label="Акцент"
          value={
            draft.focusAreas.includes('full_body')
              ? 'Усе тіло'
              : `${draft.focusAreas.length} пріоритетні зони`
          }
        />
      </div>
      <p className="mt-5 border-l-2 border-accent/50 pl-3 text-[10px] leading-5 text-muted">
        Це локальний попередній перегляд. Відповіді про форму, досвід,
        тренування та харчові звички ще не зберігаються на сервері.
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
      <BrandMark />
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
