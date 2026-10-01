'use client';

import type {
  AssignedProgramSummary,
  OnboardingMainGoal,
  PlanResponse,
  ProgramTrack,
  SubscriptionResponse,
  TrainingExperience,
  TrainingFrequency,
} from '@repo/shared-types';
import {
  EXPERIENCE_LEVELS,
  HEIGHT_CM,
  MAIN_GOALS,
  profileUpdateSchema,
  TRAINING_FREQUENCIES,
  WEIGHT_KG,
} from '@repo/validation';
import {
  Apple,
  BarChart3,
  Dumbbell,
  Home,
  LayoutGrid,
  User,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link, useRouter } from '@/i18n/navigation';
import { useLogout } from '@/lib/hooks/use-auth';
import { useAssignedProgram } from '@/lib/hooks/use-programs';
import {
  useMySubscription,
  usePlans,
  useRenewSubscription,
} from '@/lib/hooks/use-subscriptions';
import {
  useMe,
  useOnboardingResponses,
  useUpdateProfile,
} from '@/lib/hooks/use-users';
import {
  formatHryvniaAmount,
  kopiykasToHryvnia,
} from '@/lib/subscriptions/money';

const NAV_ITEMS = [
  { id: 'home', icon: Home },
  { id: 'training', icon: Dumbbell },
  { id: 'nutrition', icon: Apple },
  { id: 'progress', icon: BarChart3 },
  { id: 'profile', icon: User },
  { id: 'library', icon: LayoutGrid },
] as const;

export function ProfilePage() {
  const t = useTranslations('profile');
  const locale = useLocale();
  const router = useRouter();
  const logout = useLogout();
  const me = useMe();
  const responses = useOnboardingResponses();
  const program = useAssignedProgram();
  const subscription = useMySubscription();

  const loading = [me, responses, program, subscription].some(
    (query) => query.isPending && !query.isFetched,
  );

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/login');
  }

  if (loading) {
    return (
      <Shell>
        <p className="px-5 py-10 text-sm text-white/50">{t('loading')}</p>
      </Shell>
    );
  }

  if (me.isError || !me.data?.profile) {
    return (
      <Shell>
        <p role="alert" className="px-5 py-10 text-sm text-red-300">
          {t('loadError')}
        </p>
      </Shell>
    );
  }

  const profile = me.data.profile;
  const answers = responses.data?.responses ?? null;
  const track: ProgramTrack =
    answers?.programTrack ??
    (profile.biologicalSexForCalculation === 'MALE' ? 'male' : 'female');
  const heightCm = Number(profile.heightCm);
  const weight = me.data.bodyMeasurements[0]
    ? Number(me.data.bodyMeasurements[0].weightKg)
    : undefined;

  return (
    <Shell>
      <header className="border-b border-white/5 px-5 pt-7 pb-5">
        <Link
          href="/dashboard"
          className="font-label text-[8px] font-semibold tracking-[0.2em] text-white/30 uppercase"
        >
          {t('brand')}
        </Link>
        <h1 className="mt-1.5 font-heading text-[30px] leading-none text-white uppercase">
          {t('title')}
        </h1>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-4">
        <section className="flex items-center gap-3 border border-white/10 bg-white/[0.02] px-4 py-4">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full border border-white/15 text-white/50"
          >
            <User size={22} strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-xl leading-tight text-white">
              {profile.name ?? me.data.email}
            </p>
            <p className="mt-1 text-[12px] text-white/45">{me.data.email}</p>
            <p className="mt-1 font-label text-[8px] font-semibold tracking-[0.14em] text-white/35 uppercase">
              {t('learnerSince', {
                date: formatMonthYear(locale, me.data.createdAt),
              })}
            </p>
          </div>
        </section>

        <ParametersCard
          track={track}
          dateOfBirth={profile.dateOfBirth}
          heightCm={Number.isFinite(heightCm) ? heightCm : undefined}
          weightKg={Number.isFinite(weight) ? weight : undefined}
          experience={answers?.experience}
          mainGoal={answers?.mainGoal}
          trainingFrequency={answers?.trainingFrequency}
          loadError={responses.isError}
        />

        <ProgramCard
          program={
            program.isError || subscription.data?.status !== 'ACTIVE'
              ? null
              : (program.data ?? null)
          }
          track={track}
          active={subscription.data?.status === 'ACTIVE'}
          loadError={program.isError}
        />

        <SubscriptionCard
          subscription={
            subscription.isError ? null : (subscription.data ?? null)
          }
          loadError={subscription.isError}
        />

        <section className="border border-white/10 bg-white/[0.02] px-4 py-4">
          <h2 className="mb-3 font-label text-[8px] font-bold tracking-[0.16em] text-white/35 uppercase">
            {t('settings')}
          </h2>
          <div className="flex items-center justify-between gap-3 border-b border-white/8 py-3">
            <span className="text-sm text-white">{t('language')}</span>
            <LocaleSwitcher />
          </div>
          <InertRow label={t('notifications')} />
          <InertRow label={t('support')} />
          <InertRow label={t('privacy')} />
          <InertRow label={t('terms')} />
        </section>

        <Button
          variant="ghost"
          className="w-full border border-white/15"
          disabled={logout.isPending}
          onClick={() => void signOut()}
        >
          {t('logout')}
        </Button>
      </div>
    </Shell>
  );
}

function ParametersCard({
  track,
  dateOfBirth,
  heightCm,
  weightKg,
  experience,
  mainGoal,
  trainingFrequency,
  loadError,
}: {
  track: ProgramTrack;
  dateOfBirth: string;
  heightCm: number | undefined;
  weightKg: number | undefined;
  experience: TrainingExperience | undefined;
  mainGoal: OnboardingMainGoal | undefined;
  trainingFrequency: TrainingFrequency | undefined;
  loadError: boolean;
}) {
  const t = useTranslations('profile');
  const onboarding = useTranslations('onboarding');
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [height, setHeight] = useState(
    heightCm === undefined ? '' : String(heightCm),
  );
  const [weight, setWeight] = useState(
    weightKg === undefined ? '' : String(weightKg),
  );
  const [level, setLevel] = useState(experience ?? EXPERIENCE_LEVELS[0]);
  const [goal, setGoal] = useState(mainGoal ?? MAIN_GOALS[0]);
  const [frequency, setFrequency] = useState(
    trainingFrequency ?? TRAINING_FREQUENCIES[0],
  );
  const [error, setError] = useState<string | null>(null);
  const male = track === 'male';

  function beginEdit() {
    setHeight(heightCm === undefined ? '' : String(heightCm));
    setWeight(weightKg === undefined ? '' : String(weightKg));
    setLevel(experience ?? EXPERIENCE_LEVELS[0]);
    setGoal(mainGoal ?? MAIN_GOALS[0]);
    setFrequency(trainingFrequency ?? TRAINING_FREQUENCIES[0]);
    setError(null);
    setEditing(true);
  }

  function save() {
    const parsed = profileUpdateSchema.safeParse(
      loadError
        ? {
            heightCm: Number(height),
            weightKg: weight === '' ? undefined : Number(weight),
          }
        : {
            heightCm: Number(height),
            weightKg: weight === '' ? undefined : Number(weight),
            experience: level,
            mainGoal: goal,
            trainingFrequency: frequency,
          },
    );
    if (!parsed.success || parsed.data.weightKg === undefined) {
      setError(t('invalid'));
      return;
    }
    setError(null);
    update.mutate(parsed.data, {
      onSuccess: () => setEditing(false),
      onError: () => setError(t('saveError')),
    });
  }

  return (
    <section className="border border-white/10 bg-white/[0.02] px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-label text-[8px] font-bold tracking-[0.16em] text-white/35 uppercase">
          {t('parameters')}
        </h2>
        {editing ? (
          <button
            type="button"
            className="font-label text-[9px] font-bold tracking-[0.12em] text-white/50 uppercase"
            onClick={() => setEditing(false)}
          >
            {t('cancel')}
          </button>
        ) : (
          <button
            type="button"
            className="font-label text-[9px] font-bold tracking-[0.12em] text-[#35f5e8] uppercase"
            onClick={beginEdit}
          >
            {t('edit')}
          </button>
        )}
      </div>

      {loadError ? (
        <p role="alert" className="mb-3 text-xs text-red-300">
          {t('answersError')}
        </p>
      ) : null}

      <Detail
        label={t('sex')}
        value={track === 'female' ? t('sexFemale') : t('sexMale')}
      />
      <Detail
        label={t('age')}
        value={t('ageValue', { count: ageYears(dateOfBirth) })}
      />

      {editing ? (
        <div className="mt-3 flex flex-col gap-4">
          <NumberField
            id="profile-height"
            label={t('height')}
            unit={t('cm')}
            value={height}
            min={HEIGHT_CM.min}
            max={HEIGHT_CM.max}
            onChange={setHeight}
          />
          <NumberField
            id="profile-weight"
            label={t('weight')}
            unit={t('kg')}
            value={weight}
            min={WEIGHT_KG.min}
            max={WEIGHT_KG.max}
            onChange={setWeight}
          />
          {loadError ? null : (
            <>
              <SelectField
                id="profile-level"
                label={t('level')}
                value={level}
                options={EXPERIENCE_LEVELS.map((value) => ({
                  value,
                  label: experienceLabel(onboarding, value, male),
                }))}
                onChange={(value) => setLevel(value as TrainingExperience)}
              />
              <SelectField
                id="profile-goal"
                label={t('goal')}
                value={goal}
                options={MAIN_GOALS.map((value) => ({
                  value,
                  label: goalLabel(onboarding, value, male),
                }))}
                onChange={(value) => setGoal(value as OnboardingMainGoal)}
              />
              <SelectField
                id="profile-frequency"
                label={t('frequency')}
                value={frequency}
                options={TRAINING_FREQUENCIES.map((value) => ({
                  value,
                  label: frequencyLabel(onboarding, value),
                }))}
                onChange={(value) => setFrequency(value as TrainingFrequency)}
              />
            </>
          )}
          {error ? (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          ) : null}
          <Button className="w-full" disabled={update.isPending} onClick={save}>
            {update.isPending ? t('saving') : t('save')}
          </Button>
        </div>
      ) : (
        <>
          <Detail
            label={t('height')}
            value={
              heightCm === undefined
                ? '—'
                : `${formatMeasure(heightCm)} ${t('cm')}`
            }
          />
          <Detail
            label={t('weight')}
            value={
              weightKg === undefined
                ? '—'
                : `${formatMeasure(weightKg)} ${t('kg')}`
            }
          />
          <Detail
            label={t('level')}
            value={experienceLabel(onboarding, experience ?? '', male)}
          />
          <Detail
            label={t('goal')}
            value={goalLabel(onboarding, mainGoal ?? '', male)}
          />
          <Detail
            label={t('frequency')}
            value={frequencyLabel(onboarding, trainingFrequency ?? '')}
          />
        </>
      )}
    </section>
  );
}

function ProgramCard({
  program,
  track,
  active,
  loadError,
}: {
  program: AssignedProgramSummary | null;
  track: ProgramTrack;
  active: boolean;
  loadError: boolean;
}) {
  const t = useTranslations('profile');
  const onboarding = useTranslations('onboarding');
  const locale = useLocale();
  const male = track === 'male';

  return (
    <section className="border border-[rgba(53,245,232,0.18)] bg-[rgba(53,245,232,0.04)] px-4 py-4">
      <h2 className="mb-3 font-label text-[8px] font-bold tracking-[0.16em] text-white/35 uppercase">
        {t('program')}
      </h2>
      {loadError ? (
        <p role="alert" className="text-sm text-red-300">
          {t('programError')}
        </p>
      ) : program ? (
        <>
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="font-heading text-lg leading-tight break-words text-[#35f5e8]">
              {program.templateName}
            </p>
            {active ? (
              <span className="shrink-0 bg-[#c8ff2e] px-2 py-1 font-label text-[8px] font-bold tracking-[0.12em] text-[#0b0b0b] uppercase">
                {t('programStatus')}
              </span>
            ) : null}
          </div>
          <Detail
            label={t('started')}
            value={formatDay(locale, program.assignedAt)}
          />
          <Detail
            label={t('perWeek')}
            value={String(program.frequencyPerWeek)}
          />
          <Detail
            label={t('level')}
            value={experienceLabel(onboarding, program.level, male)}
          />
          {program.programProgress ? (
            <Detail
              label={t('sessions')}
              value={t('sessionCount', {
                completed: program.programProgress.completed,
                expected: program.programProgress.expected,
              })}
            />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-white/45">{t('noProgram')}</p>
      )}
    </section>
  );
}

function SubscriptionCard({
  subscription,
  loadError,
}: {
  subscription: SubscriptionResponse | null;
  loadError: boolean;
}) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState<string | null>(
    subscription?.planId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const plans = usePlans(open);
  const renew = useRenewSubscription();
  const selectedId = planId ?? plans.data?.[0]?.id ?? '';

  function confirm() {
    if (!selectedId) return;
    setError(null);
    renew.mutate(selectedId, {
      onSuccess: (response) => {
        if (response.checkoutUrl) {
          window.location.assign(response.checkoutUrl);
          return;
        }
        setOpen(false);
      },
      onError: () => setError(t('renewError')),
    });
  }

  return (
    <section className="border border-white/10 bg-white/[0.02] px-4 py-4">
      <h2 className="mb-3 font-label text-[8px] font-bold tracking-[0.16em] text-white/35 uppercase">
        {t('subscription')}
      </h2>
      {loadError ? (
        <p role="alert" className="text-sm text-red-300">
          {t('subscriptionError')}
        </p>
      ) : subscription ? (
        <>
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="font-heading text-lg text-white">
              {subscription.plan.name}
            </p>
            <StatusBadge status={subscription.status} />
          </div>
          <Detail
            label={t('accessUntil')}
            value={
              subscription.currentPeriodEnd
                ? formatDay(locale, subscription.currentPeriodEnd)
                : '—'
            }
          />
        </>
      ) : (
        <p className="mb-3 text-sm text-white/45">{t('noSubscription')}</p>
      )}

      {loadError ? null : open ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="font-label text-[8px] font-semibold tracking-[0.14em] text-white/35 uppercase">
            {t('choosePlan')}
          </p>
          {(plans.data ?? []).map((plan) => (
            <PlanOption
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedId}
              onSelect={() => setPlanId(plan.id)}
            />
          ))}
          {error ? (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          ) : null}
          <Button
            className="mt-2 w-full"
            disabled={!selectedId || renew.isPending}
            onClick={confirm}
          >
            {renew.isPending ? t('renewing') : t('confirmRenew')}
          </Button>
        </div>
      ) : (
        <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
          {t('renew')}
        </Button>
      )}
    </section>
  );
}

function PlanOption({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanResponse;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex w-full items-center justify-between border px-3 py-3 text-left ${
        selected ? 'border-[#35f5e8] bg-[#35f5e8]/8' : 'border-white/10'
      }`}
    >
      <span className="text-sm text-white">{plan.name}</span>
      <span className="font-heading text-lg text-white">
        {formatHryvniaAmount(kopiykasToHryvnia(plan.priceAmount))} ₴
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: SubscriptionResponse['status'] }) {
  const t = useTranslations('profile');
  const active = status === 'ACTIVE';
  return (
    <span
      className={`shrink-0 px-2 py-1 font-label text-[8px] font-bold tracking-[0.12em] uppercase ${
        active ? 'bg-[#c8ff2e] text-[#0b0b0b]' : 'bg-white/10 text-white/60'
      }`}
    >
      {t(`statuses.${status}`)}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/6 py-2.5">
      <p className="text-[12px] text-white/45">{label}</p>
      <p className="text-right text-[13px] text-white">{value}</p>
    </div>
  );
}

function NumberField({
  id,
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[12px] text-white/45">
        {label} ({unit})
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-white/15 bg-transparent px-3 py-2 text-white outline-none"
      />
    </label>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] text-white/45">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InertRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="flex w-full cursor-not-allowed items-center justify-between border-b border-white/8 py-3 text-left text-sm text-white/35"
    >
      {label}
    </button>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#0b0b0b] pb-24 text-white">
      {children}
      <ProfileNav />
    </div>
  );
}

function ProfileNav() {
  const t = useTranslations('dashboard');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[430px] border-t border-white/10 bg-[#0b0b0b] pb-[env(safe-area-inset-bottom,0px)]">
      {NAV_ITEMS.map((item) => {
        const active = item.id === 'profile';
        const Icon = item.icon;
        const className =
          'relative flex flex-1 flex-col items-center gap-1 px-0.5 pt-2.5 pb-3';
        const content = (
          <>
            {active ? (
              <span className="absolute top-0 left-1/2 h-px w-[22px] -translate-x-1/2 bg-[#35f5e8]" />
            ) : null}
            <Icon
              size={20}
              strokeWidth={1.6}
              className={
                active
                  ? 'text-[#35f5e8]'
                  : item.id === 'home'
                    ? 'text-white/70'
                    : 'text-white/30'
              }
            />
            <span
              className={`text-[7px] whitespace-nowrap ${
                active
                  ? 'font-semibold text-[#35f5e8]'
                  : item.id === 'home'
                    ? 'font-medium text-white/70'
                    : 'font-medium text-white/30'
              }`}
            >
              {t(`home.nav.${item.id}`)}
            </span>
          </>
        );
        if (item.id === 'home') {
          return (
            <Link key={item.id} href="/dashboard" className={className}>
              {content}
            </Link>
          );
        }
        if (item.id === 'profile') {
          return (
            <Link
              key={item.id}
              href="/profile"
              aria-current="page"
              className={className}
            >
              {content}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            disabled={!active}
            aria-current={active ? 'page' : undefined}
            className={`${className} disabled:cursor-not-allowed`}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}

function goalLabel(
  t: ReturnType<typeof useTranslations<'onboarding'>>,
  mainGoal: string,
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

function experienceLabel(
  t: ReturnType<typeof useTranslations<'onboarding'>>,
  experience: string,
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

function frequencyLabel(
  t: ReturnType<typeof useTranslations<'onboarding'>>,
  frequency: string,
) {
  switch (frequency) {
    case '2':
      return t('choices.frequency.2.label');
    case '3':
      return t('choices.frequency.3.label');
    case '4':
      return t('choices.frequency.4.label');
    default:
      return '—';
  }
}

export function ageYears(dateOfBirth: string, now = new Date()) {
  const parts = dateOfBirth.slice(0, 10).split('-');
  const birth = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
  );
  let age = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatMeasure(value: number) {
  return new Intl.NumberFormat('uk', { maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatMonthYear(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDay(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
