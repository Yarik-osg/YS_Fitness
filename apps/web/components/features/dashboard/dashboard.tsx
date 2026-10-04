'use client';

import type { AssignedProgramResponse } from '@repo/shared-types';
import { Dumbbell } from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { useState } from 'react';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ClientNav } from '@/components/features/shell/client-nav';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { useLogout } from '@/lib/hooks/use-auth';
import { useAssignProgram, useMyProgram } from '@/lib/hooks/use-programs';
import { useMySubscription } from '@/lib/hooks/use-subscriptions';
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
      className="mx-auto grid min-h-screen w-full max-w-[430px] place-items-center bg-[#0b0b0b] px-6"
    >
      <div className="h-0.5 w-24 animate-pulse bg-white/30" />
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
  const dayNumber = String(day?.dayNumber ?? 1).padStart(2, '0');
  const dayLabel = t('home.firstDay', { number: dayNumber });
  const quotes = messages.dashboard.home.quotes;
  const quote = quotes[new Date().getDay() % quotes.length] ?? quotes[0];

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/login');
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#0b0b0b] pb-24">
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
        <section className="border-[1.5px] border-[rgba(53,245,232,0.12)] bg-[rgba(53,245,232,0.04)] px-[18px] py-[18px]">
          <p className="mb-3 font-label text-[7px] font-semibold tracking-[0.18em] text-white/30 uppercase">
            {t('home.today')}
          </p>
          <p className="mb-3.5 font-heading text-xl tracking-[0.04em] break-words text-[#35f5e8]">
            {program.templateName}
          </p>
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
              className={buttonVariants({
                className: 'w-full text-[#0b0b0b]!',
              })}
            >
              {t('home.start')}
            </Link>
          ) : (
            <Button className="w-full" disabled>
              {t('home.start')}
            </Button>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/training"
            className="relative block min-h-[130px] overflow-hidden border-[1.5px] border-[rgba(200,255,46,0.2)] px-4 py-[18px]"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-[#c8ff2e] to-transparent" />
            <p className="mb-2 font-label text-[7px] font-bold tracking-[0.16em] text-[rgba(200,255,46,0.7)] uppercase">
              {t('home.training')}
            </p>
            <p className="font-heading text-[17px] leading-tight tracking-[0.02em] text-white uppercase">
              {dayLabel}
            </p>
            <p className="mt-3 text-[10px] font-medium text-white/35">
              {t('home.summary', { exercises: exerciseCount, sets: setCount })}
            </p>
            <Chevron className="absolute right-3.5 bottom-3.5 text-[#c8ff2e]" />
          </Link>

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
            <p className="mt-1 line-clamp-2 font-label text-[7.5px] font-bold tracking-[0.08em] text-white/25">
              {program.templateName}
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

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/login');
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-7 pb-24">
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

      <header className="pt-14 pb-10">
        <p className="font-label text-[10px] tracking-[0.2em] text-accent uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 max-w-lg font-heading text-5xl leading-none uppercase">
          {t('title')} <span className="text-accent">{t('titleAccent')}</span>
        </h1>
        <p className="mt-5 text-sm text-muted">{user?.name ?? user?.email}</p>
        {user?.name ? (
          <p className="mt-1 text-xs text-muted">{user.email}</p>
        ) : null}
        {subscription.data ? (
          <p className="mt-3 text-sm text-muted">
            {t('subscription.active', {
              plan: subscription.data.plan.name,
              periodEnd: formatPeriodEnd(
                subscription.data.currentPeriodEnd,
                locale,
              ),
            })}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">{t('subscription.none')}</p>
        )}
      </header>

      <AssignProgramCard program={program} />
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
  const assign = useAssignProgram();
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
  const loadFailed = displayedError != null && !subscriptionRequired;
  const assignFailed =
    assign.isError && !unavailable && !isSubscriptionRequired(assign.error);

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
            : subscriptionRequired
              ? t('subscription.none')
              : loadFailed
                ? t('workouts.loadError')
                : assignFailed
                  ? t('workouts.assignError')
                  : t('workouts.prompt')}
        </p>
        {unavailable || subscriptionRequired ? null : loadFailed ? (
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
            onClick={() => void assign.mutate()}
          >
            {assign.isPending ? t('workouts.assigning') : t('workouts.assign')}
          </Button>
        )}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-medium text-white/40">{label}</p>
      <p className="font-label text-[10px] font-bold tracking-[0.08em] text-white uppercase">
        {value}
      </p>
    </div>
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

function formatHomeDate(locale: string, date: Date) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatPeriodEnd(value: string | null, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(value));
}
