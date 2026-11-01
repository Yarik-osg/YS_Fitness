'use client';

import type { AssignedProgramResponse } from '@repo/shared-types';
import { Dumbbell } from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import {
  formatHomeDate,
  HomeGhost,
  Stat,
} from '@/components/features/dashboard/home-ghost';
import { BlurredProgram } from '@/components/features/subscription/locked-screen';
import { ClientNav } from '@/components/features/shell/client-nav';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ERROR_DURATION_MS } from '@/components/ui/toaster';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { useLogout } from '@/lib/hooks/use-auth';
import { ProgramPromotionSheet } from '@/components/features/programs/program-promotion-sheet';
import { useAssignProgram, useMyProgram } from '@/lib/hooks/use-programs';
import { useMySubscription } from '@/lib/hooks/use-subscriptions';
import { grantsActiveAccess } from '@/lib/subscriptions/access';
import { useMeasurements } from '@/lib/hooks/use-users';
import {
  useCalculateNutrition,
  useNutritionCalculations,
} from '@/lib/hooks/use-nutrition';
import { roundHalfAwayFromZero, shownNutrition } from '@/lib/nutrition-display';
import { useClientProgramTitle } from '@/lib/program-title';
import {
  formatDelta,
  formatWeight,
  latestMeasurement,
} from '@/lib/weight-chart';
import { useHasWorkoutDraft } from '@/lib/workout-draft';
import { useAuthStore } from '@/lib/stores/auth-store';

export function Dashboard() {
  const program = useMyProgram();

  if (program.isPending && !program.isFetched) {
    return <HomeLoading />;
  }

  if (program.data) {
    return <AssignedHome program={program.data} />;
  }

  return <UnassignedDashboard program={program} />;
}

function HomeLoading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto min-h-screen w-full max-w-[430px] bg-background px-4 pt-7 pb-24"
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2 w-24" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="mb-3 h-44 w-full" />
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
      <ClientNav active="home" />
    </main>
  );
}

function AssignedHome({ program }: { program: AssignedProgramResponse }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const t = useTranslations('dashboard');
  const messages = useMessages();
  const locale = useLocale();
  const day =
    program.days.find((entry) => entry.dayNumber === program.nextDayNumber) ??
    program.days[0];
  const exerciseCount = day?.exercises.length ?? 0;
  const setCount =
    day?.exercises.reduce((total, row) => total + row.sets, 0) ?? 0;
  const hasDraft = useHasWorkoutDraft(
    user?.id,
    program.templateId,
    day?.dayNumber ?? 0,
  );
  const dayNumber = String(day?.dayNumber ?? 1).padStart(2, '0');
  const dayLabel = t('home.firstDay', { number: dayNumber });
  const programTitle = useClientProgramTitle(program);
  const quotes = messages.dashboard.home.quotes;
  const quote = quotes[new Date().getDay() % quotes.length] ?? quotes[0];

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/login');
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-24">
      <header className="flex items-start justify-between gap-3 border-b border-white/5 px-5 pt-7 pb-5">
        <div>
          <p className="font-label text-[8px] font-semibold tracking-[0.2em] text-white/30 uppercase">
            {formatHomeDate(locale, new Date())}
          </p>
          <h1 className="mt-1.5 font-heading text-[30px] leading-none text-white uppercase">
            {t('home.screenTitle')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void signOut()}
            disabled={logout.isPending}
          >
            {t('logout')}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-4">
        <section className="border-[1.5px] border-teal/12 bg-teal/4 px-[18px] py-[18px]">
          <h2 className="mb-3.5 font-heading text-xl tracking-[0.04em] break-words text-teal">
            {programTitle}
          </h2>
          <div className="mb-4 flex flex-col gap-1.5">
            <Stat label={t('home.nextWorkout')} value={dayLabel} />
            <Stat
              label={t('home.perWeek')}
              value={t('home.times', { count: program.frequencyPerWeek })}
            />
            {program.programProgress ? (
              <Stat
                label={t('home.sessions')}
                value={t('home.sessionCount', {
                  completed: program.programProgress.completed,
                  expected: program.programProgress.expected,
                })}
              />
            ) : null}
          </div>
          {day ? (
            <Link
              href="/workout"
              className={buttonVariants({ className: 'w-full' })}
            >
              {hasDraft ? t('home.continue') : t('home.start')}
            </Link>
          ) : (
            <Button className="w-full" disabled>
              {t('home.start')}
            </Button>
          )}
        </section>

        <ProgramPromotionSheet
          enabled={
            program.templateOrigin === 'SYSTEM' &&
            program.assignmentSource === 'MATCHED' &&
            program.programProgress.completed >=
              program.programProgress.expected
          }
        />

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/training"
            className="relative block min-h-[130px] overflow-hidden border-[1.5px] border-lime/20 px-4 py-[18px]"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-lime to-transparent" />
            <p className="mb-2 font-label text-[7px] font-bold tracking-[0.16em] text-lime/70 uppercase">
              {t('home.training')}
            </p>
            <p className="font-heading text-[17px] leading-tight tracking-[0.02em] text-white uppercase">
              {dayLabel}
            </p>
            <p className="mt-3 text-[10px] font-medium text-white/35">
              {t('home.summary', { exercises: exerciseCount, sets: setCount })}
            </p>
            <Chevron className="absolute right-3.5 bottom-3.5 text-lime" />
          </Link>
          <NutritionHomeCard />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <ProgressHomeCard
            completed={program.programProgress?.completed}
            expected={program.programProgress?.expected}
          />

          <Link
            href="/profile"
            className="relative block min-h-[100px] overflow-hidden border-[1.5px] border-white/10 bg-white/[0.02] px-4 py-4"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-white/20 to-transparent" />
            <p className="mb-2 font-label text-[7px] font-bold tracking-[0.16em] text-white/35 uppercase">
              {t('home.profile')}
            </p>
            <p className="font-heading text-[17px] leading-tight text-white">
              {user?.name ?? user?.email}
            </p>
            <p className="mt-1 text-[8.5px] leading-snug font-medium text-white/40">
              {t(`home.levels.${program.level}`)}
            </p>
            <p className="text-[8.5px] leading-snug font-medium text-white/40">
              {t('home.timesShort', { count: program.frequencyPerWeek })}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-white/70">
              {programTitle}
            </p>
            <Chevron className="absolute right-3 bottom-3 text-white/40" />
          </Link>
        </div>

        <p className="border-l-2 border-white/10 bg-white/[0.01] px-[18px] py-4 font-serif text-[15px] leading-relaxed text-white/40 italic">
          “{quote}”
        </p>
      </div>

      <ClientNav active="home" />
    </div>
  );
}

function UnassignedDashboard({
  program,
}: {
  program: ReturnType<typeof useMyProgram>;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const subscription = useMySubscription();
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const access = grantsActiveAccess(subscription.data ?? null);
  const locked = subscription.isSuccess && !access;

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/login');
  }

  return (
    <main
      className={`mx-auto min-h-screen w-full px-6 pt-7 pb-24 ${locked ? 'max-w-[430px]' : 'max-w-3xl'}`}
    >
      <nav className="flex items-center justify-between border-b border-line pb-5">
        <Link href="/" className="inline-flex">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void signOut()}
            disabled={logout.isPending}
          >
            {t('logout')}
          </Button>
        </div>
      </nav>

      {locked ? null : (
        <header className="pt-14 pb-10">
          <h1 className="max-w-lg font-heading text-5xl leading-none uppercase">
            {t('title')} <span className="text-accent">{t('titleAccent')}</span>
          </h1>
          <p className="mt-5 text-sm text-muted">{user?.name ?? user?.email}</p>
          {user?.name ? (
            <p className="mt-1 text-xs text-muted">{user.email}</p>
          ) : null}
          {access && subscription.data ? (
            <p className="mt-3 text-sm text-muted">
              {t('subscription.active', {
                plan: subscription.data.plan.name,
                periodEnd: formatPeriodEnd(
                  subscription.data.currentPeriodEnd,
                  locale,
                ),
              })}
            </p>
          ) : subscription.isPending ? null : (
            <p className="mt-3 text-sm text-muted">{t('subscription.none')}</p>
          )}
        </header>
      )}

      {locked ? (
        <BlurredProgram>
          <HomeGhost />
        </BlurredProgram>
      ) : (
        <AssignProgramCard program={program} />
      )}
      <ClientNav active="home" />
    </main>
  );
}

export function AssignProgramCard({
  program,
}: {
  program: ReturnType<typeof useMyProgram>;
}) {
  const t = useTranslations('dashboard');
  const tCheckout = useTranslations('checkout');
  const assign = useAssignProgram();
  const subscription = useMySubscription();
  const [heldError, setHeldError] = useState<unknown>(null);
  if (program.status === 'success') {
    if (heldError !== null) setHeldError(null);
  } else if (program.error != null && heldError !== program.error) {
    setHeldError(program.error);
  }
  const displayedError =
    program.error ?? (program.fetchStatus !== 'idle' ? heldError : null);
  const unavailable = isProgramUnavailable(assign.error);
  const subscriptionRequired = isSubscriptionRequired(
    displayedError ?? assign.error,
  );
  const locked =
    subscription.isSuccess && !grantsActiveAccess(subscription.data ?? null);
  const needsPlan = locked || (!subscription.isSuccess && subscriptionRequired);
  const loadFailed = displayedError != null && !needsPlan;

  return (
    <article className="border border-line bg-panel p-5">
      <div className="mb-8 text-accent">
        <Dumbbell />
      </div>
      <h2 className="font-heading text-xl uppercase">{t('workouts.title')}</h2>
      <div className="mt-2 space-y-3">
        <p className="text-xs leading-5 text-muted">
          {unavailable
            ? t('workouts.unavailable')
            : needsPlan
              ? t('subscription.none')
              : loadFailed
                ? t('workouts.loadError')
                : t('workouts.prompt')}
        </p>
        {unavailable ? null : needsPlan ? (
          <Link href="/checkout" className={buttonVariants({ size: 'sm' })}>
            {tCheckout('choosePlanCta')}
          </Link>
        ) : loadFailed ? (
          <Button
            size="sm"
            disabled={program.isFetching}
            onClick={() => void program.refetch()}
          >
            {t('workouts.retry')}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={assign.isPending}
            onClick={() =>
              void assign.mutate(undefined, {
                onSuccess: () => toast.success(t('workouts.assigned')),
                onError: (error) => {
                  if (
                    !isProgramUnavailable(error) &&
                    !isSubscriptionRequired(error)
                  ) {
                    toast.error(t('workouts.assignError'), {
                      duration: ERROR_DURATION_MS,
                    });
                  }
                },
              })
            }
          >
            {assign.isPending ? t('workouts.assigning') : t('workouts.assign')}
          </Button>
        )}
      </div>
    </article>
  );
}

function NutritionHomeCard() {
  const t = useTranslations('dashboard');
  const calculations = useNutritionCalculations();
  const { mutate } = useCalculateNutrition();
  const started = useRef(false);
  const latest = calculations.data?.calculations[0] ?? null;
  const shown = shownNutrition(latest, calculations.data?.target);

  useEffect(() => {
    if (
      started.current ||
      !calculations.isSuccess ||
      calculations.isFetching ||
      latest
    ) {
      return;
    }
    started.current = true;
    mutate();
  }, [mutate, calculations.isSuccess, calculations.isFetching, latest]);

  const pending = calculations.isPending && calculations.data === undefined;

  return (
    <Link
      href="/nutrition"
      className="relative block min-h-[130px] overflow-hidden border-[1.5px] border-teal/20 px-4 py-[18px]"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-teal to-transparent" />
      <p className="mb-2 font-label text-[7px] font-bold tracking-[0.16em] text-teal/70 uppercase">
        {t('home.nav.nutrition')}
      </p>
      {pending ? (
        <Skeleton className="h-7 w-20" />
      ) : shown ? (
        <>
          <p className="mb-1.5 flex items-baseline gap-1">
            <span className="font-heading text-[26px] leading-none tracking-[-0.02em] text-teal tabular-nums">
              {roundHalfAwayFromZero(shown.targetCalories)}
            </span>
            <span className="font-label text-[8px] font-semibold tracking-[0.08em] text-white/30 uppercase">
              {t('home.nutritionKcal')}
            </span>
          </p>
          <p className="text-[9px] leading-snug font-medium text-white/40 tabular-nums">
            {t('home.nutritionMacros', {
              protein: roundHalfAwayFromZero(shown.proteinGrams),
              fat: roundHalfAwayFromZero(shown.fatGrams),
              carbs: roundHalfAwayFromZero(shown.carbsGrams),
            })}
          </p>
        </>
      ) : null}
      <p className="mt-3 font-label text-[8px] font-semibold tracking-[0.08em] text-teal/60">
        {t('home.nutritionDaily')}
      </p>
    </Link>
  );
}

function ProgressHomeCard({
  completed,
  expected,
}: {
  completed?: number;
  expected?: number;
}) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const measurements = useMeasurements();
  const points = measurements.data?.measurements ?? [];
  const current = latestMeasurement(points);
  const first = measurements.data?.firstMeasurement ?? null;
  const delta =
    current && first && current.id !== first.id
      ? current.weightKg - first.weightKg
      : null;
  const loading = measurements.isPending && !measurements.data;

  return (
    <Link
      href="/progress"
      className="relative block min-h-[100px] overflow-hidden border-[1.5px] border-teal/15 bg-teal/4 px-4 py-4"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-teal to-transparent" />
      <p className="mb-2 font-label text-[7px] font-bold tracking-[0.16em] text-teal/65 uppercase">
        {t('home.nav.progress')}
      </p>
      {loading ? (
        <Skeleton className="h-6 w-16" />
      ) : measurements.isError ? (
        <p role="alert" className="text-[9px] font-medium text-amber">
          {t('home.weightError')}
        </p>
      ) : (
        <>
          <p className="font-heading text-xl leading-none text-white tabular-nums">
            {current
              ? `${formatWeight(locale, current.weightKg)} ${t('home.kg')}`
              : '—'}
          </p>
          {delta === null ? null : (
            <p className="mt-1 text-[9px] font-medium text-teal">
              {t('home.sinceStart', { delta: formatDelta(locale, delta) })}
            </p>
          )}
        </>
      )}
      {completed === undefined || expected === undefined ? null : (
        <p className="mt-1.5 text-[9px] font-medium text-white/35">
          {t('home.sessionsLine', { completed, expected })}
        </p>
      )}
      <Chevron className="absolute right-3 bottom-3 text-teal" />
    </Link>
  );
}

function Chevron({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.33"
      />
      <path
        d="M8 7l4 3-4 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isProgramUnavailable(error: unknown) {
  return (
    error instanceof ApiClientError && error.code === 'PROGRAM_NOT_AVAILABLE'
  );
}

function isSubscriptionRequired(error: unknown) {
  return (
    error instanceof ApiClientError && error.code === 'SUBSCRIPTION_REQUIRED'
  );
}

function formatPeriodEnd(value: string | null, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(value));
}
