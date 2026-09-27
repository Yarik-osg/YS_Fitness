'use client';

import type { AssignedProgramResponse } from '@repo/shared-types';
import { Activity, Dumbbell, Salad } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { useLogout } from '@/lib/hooks/use-auth';
import { useAssignProgram, useMyProgram } from '@/lib/hooks/use-programs';
import { useMySubscription } from '@/lib/hooks/use-subscriptions';
import { useAuthStore } from '@/lib/stores/auth-store';

export function Dashboard() {
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
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pb-12 pt-7">
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

      <header className="pb-10 pt-14">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 max-w-lg font-heading text-5xl uppercase leading-none">
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

      <section className="grid gap-4 md:grid-cols-3">
        <TrainingCard />
        <DashboardCard
          icon={<Salad />}
          title={t('nutrition.title')}
          text={t('nutrition.text')}
        />
        <DashboardCard
          icon={<Activity />}
          title={t('progress.title')}
          text={t('progress.text')}
        />
      </section>
    </main>
  );
}

function TrainingCard() {
  const t = useTranslations('dashboard');
  const program = useMyProgram();
  const assign = useAssignProgram();
  const unavailable = isProgramUnavailable(assign.error);
  const subscriptionRequired = isSubscriptionRequired(
    program.error ?? assign.error,
  );
  const loadFailed = program.isError && !subscriptionRequired;
  const assignFailed =
    assign.isError && !unavailable && !isSubscriptionRequired(assign.error);

  return (
    <article
      className={`border border-line bg-panel p-5${program.data ? ' md:col-span-3' : ''}`}
    >
      <div className="mb-8 text-accent">
        <Dumbbell />
      </div>
      <h2 className="font-heading text-xl uppercase">{t('workouts.title')}</h2>
      {program.isPending ? (
        <p className="mt-2 text-xs leading-5 text-muted">
          {t('workouts.loading')}
        </p>
      ) : program.data ? (
        <AssignedDays program={program.data} />
      ) : (
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
              {assign.isPending
                ? t('workouts.assigning')
                : t('workouts.assign')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function AssignedDays({ program }: { program: AssignedProgramResponse }) {
  const t = useTranslations('dashboard');

  return (
    <div className="mt-6 space-y-6">
      {program.days.map((day) => {
        const last = day.exercises.at(-1);
        return (
          <section key={day.dayNumber}>
            <h3 className="font-heading text-lg uppercase">
              {t('workouts.day', { number: day.dayNumber })}
            </h3>
            <ol className="mt-3 space-y-3">
              {day.exercises.map((row) => (
                <li key={`${day.dayNumber}-${row.order}`} className="text-sm">
                  <p>
                    {row.order}. {row.exercise.name}
                  </p>
                  <p className="text-xs text-muted">
                    {row.exercise.muscleGroups
                      .map((group) => t(`workouts.muscles.${group}`))
                      .join(', ')}
                    {' · '}
                    {t('workouts.prescription', {
                      sets: row.sets,
                      repsMin: row.exercise.repsMin,
                      repsMax: row.exercise.repsMax,
                    })}
                  </p>
                </li>
              ))}
              {last?.allowsAbsAddon ? (
                <li className="text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span>
                      {last.order + 1}. {t('workouts.absExercise')}
                    </span>
                    <span className="shrink-0 bg-[#c8ff2e] px-[9px] py-[3px] font-label text-[7px] font-bold tracking-[0.12em] text-[#0b0b0b] uppercase">
                      {t('workouts.optional')}
                    </span>
                  </p>
                </li>
              ) : null}
            </ol>
          </section>
        );
      })}
    </div>
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

function DashboardCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="border border-line bg-panel p-5">
      <div className="mb-8 text-accent">{icon}</div>
      <h2 className="font-heading text-xl uppercase">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-muted">{text}</p>
    </article>
  );
}

function formatPeriodEnd(value: string | null, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(value));
}
