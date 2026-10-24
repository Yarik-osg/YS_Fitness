'use client';

import type { ReactNode } from 'react';
import type {
  CoachClientDetail,
  CoachClientOnboarding,
} from '@repo/shared-types';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { CoachClientHistory } from '@/components/features/coach/coach-client-history';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { useCoachClient } from '@/lib/hooks/use-coach-clients';
import { useProgramTitle } from '@/lib/program-title';

export function CoachClientPage({ userId }: { userId: string }) {
  const t = useTranslations('coach');
  const client = useCoachClient(userId);
  const notFound =
    client.error instanceof ApiClientError && client.error.status === 404;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <Link
        href="/coach"
        className="font-label text-xs font-semibold tracking-[0.12em] text-muted uppercase hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t('back')}
      </Link>

      {client.isPending ? (
        <div aria-busy="true" className="mt-8 flex flex-col gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {notFound ? (
        <p role="alert" className="mt-8 text-sm text-muted">
          {t('notFound')}
        </p>
      ) : null}

      {client.isError && !notFound ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <p role="alert" className="text-sm text-amber">
            {t('loadError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => void client.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {client.data ? <ClientDetail detail={client.data} /> : null}
    </main>
  );
}

function ClientDetail({ detail }: { detail: CoachClientDetail }) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const title = useProgramTitle(detail.program?.accent ?? '');
  const joined = formatDate(locale, detail.createdAt);

  return (
    <>
      <h1 className="mt-4 font-heading text-4xl leading-none text-ink uppercase">
        {detail.name?.trim() ? detail.name : t('unnamed')}
      </h1>
      <p className="mt-3 text-sm text-ink">{detail.email}</p>
      <p className="mt-1 text-sm text-muted">
        {t('joined')} {joined}
      </p>
      <p
        className={`mt-1 text-sm ${detail.onboardingCompleted ? 'text-lime' : 'text-muted'}`}
      >
        {t('onboarding')}{' '}
        {detail.onboardingCompleted
          ? t('onboardingDone')
          : t('onboardingMissing')}
      </p>

      <Section title={t('sections.profile')}>
        {detail.profile ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('fields.birthDate')}
              value={formatCalendarDate(locale, detail.profile.dateOfBirth)}
            />
            <Field
              label={t('fields.sex')}
              value={t(`sex.${detail.profile.biologicalSexForCalculation}`)}
            />
            <Field
              label={t('fields.height')}
              value={`${formatHeight(locale, detail.profile.heightCm)} ${t('cm')}`}
            />
            <Field
              label={t('fields.activity')}
              value={
                <ChoiceText
                  path={`activity.${detail.profile.activityLevel}.label`}
                  fallback={detail.profile.activityLevel}
                />
              }
            />
            <Field
              label={t('fields.goal')}
              value={
                <ChoiceText
                  path={`weightGoal.${detail.profile.goal}.label`}
                  fallback={detail.profile.goal}
                />
              }
            />
            <Field
              label={t('fields.timezone')}
              value={detail.profile.timezone}
            />
          </dl>
        ) : (
          <p className="text-sm text-muted">{t('noProfile')}</p>
        )}
      </Section>

      <Section title={t('sections.questionnaire')}>
        {detail.onboarding ? (
          <Answers answers={detail.onboarding} />
        ) : (
          <p className="text-sm text-muted">{t('noOnboarding')}</p>
        )}
      </Section>

      <Section title={t('sections.program')} className="mt-10">
        {detail.program ? (
          <div>
            <h2 className="font-heading text-xl text-teal">{title}</h2>
            <p className="mt-2 text-sm text-ink">
              <ChoiceText
                path={
                  detail.program.level === 'advanced'
                    ? `experience.advanced_${detail.program.gender}`
                    : `experience.${detail.program.level}.label`
                }
                fallback={detail.program.level}
              />
              {' · '}
              {t('times', { count: detail.program.frequencyPerWeek })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t('fields.assigned')}{' '}
              {formatDate(locale, detail.program.assignedAt)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('noProgram')}</p>
        )}
      </Section>

      <Section
        title={t('sections.subscription')}
        className="mt-8 border border-line px-4 py-3"
      >
        {detail.subscription ? (
          <div>
            <p
              className={
                detail.subscription.active
                  ? 'text-sm text-lime'
                  : 'text-sm text-muted'
              }
            >
              {detail.subscription.active
                ? t('subscriptionActive')
                : t('subscriptionInactive')}
            </p>
            <p className="mt-2 text-sm text-ink">
              {detail.subscription.planName}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t(`status.${detail.subscription.status}`)}
              {detail.subscription.currentPeriodEnd
                ? ` · ${t('fields.periodEnd')} ${formatDate(locale, detail.subscription.currentPeriodEnd)}`
                : ''}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('noSubscription')}</p>
        )}
      </Section>

      <CoachClientHistory userId={detail.id} />
    </>
  );
}

function Answers({ answers }: { answers: CoachClientOnboarding }) {
  const t = useTranslations('coach');
  const track = answers.programTrack;
  const mealsKey =
    track === 'female'
      ? `meals.${answers.mealsPerDay}.label`
      : `mealsMale.${answers.mealsPerDay}.label`;
  const habitsPrefix = track === 'female' ? 'habitsFemale' : 'habitsMale';

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Field
        label={t('fields.track')}
        value={<ChoiceText path={`program.${track}.label`} fallback={track} />}
      />
      <Field
        label={t('fields.currentBody')}
        value={<ScaleLabel value={answers.currentBody} steps={10} />}
      />
      <Field
        label={t('fields.desiredBody')}
        value={<ScaleLabel value={answers.desiredBody} steps={4} />}
      />
      <Field
        label={t('fields.mainGoal')}
        value={
          <ChoiceText
            path={
              answers.mainGoal === 'get_stronger'
                ? `mainGoal.get_stronger_${track}`
                : `mainGoal.${answers.mainGoal}`
            }
            fallback={answers.mainGoal}
          />
        }
      />
      <Field
        label={t('fields.experience')}
        value={
          <ChoiceText
            path={
              answers.experience === 'advanced'
                ? `experience.advanced_${track}`
                : `experience.${answers.experience}.label`
            }
            fallback={answers.experience}
          />
        }
      />
      <Field
        label={t('fields.frequency')}
        value={
          <ChoiceText
            path={`frequency.${answers.trainingFrequency}.label`}
            fallback={answers.trainingFrequency}
          />
        }
      />
      <Field
        label={t('fields.focus')}
        value={<ChoiceList prefix="focus" values={answers.focusAreas} />}
      />
      <Field
        label={t('fields.nutrition')}
        value={
          <ChoiceText
            path={`nutrition.${answers.nutritionCurrent}`}
            fallback={answers.nutritionCurrent}
          />
        }
      />
      <Field
        label={t('fields.meals')}
        value={<ChoiceText path={mealsKey} fallback={answers.mealsPerDay} />}
      />
      <Field
        label={t('fields.habits')}
        value={
          <ChoiceList prefix={habitsPrefix} values={answers.eatingHabits} />
        }
      />
      <Field
        label={t('fields.physique')}
        value={
          answers.physiqueLevel ? (
            <ScaleLabel value={answers.physiqueLevel} steps={10} />
          ) : (
            t('emptyValue')
          )
        }
      />
    </dl>
  );
}

function ScaleLabel({ value, steps }: { value: string; steps: number }) {
  const t = useTranslations('coach');
  const variant = useTranslations('onboarding');
  const index = Number(value);
  if (
    !value ||
    !Number.isInteger(index) ||
    String(index) !== value ||
    index < 0 ||
    index >= steps
  ) {
    return value || t('emptyValue');
  }
  return variant('variant', { index: index + 1 });
}

function ChoiceList({ prefix, values }: { prefix: string; values: string[] }) {
  const t = useTranslations('coach');
  if (values.length === 0) return t('emptyValue');
  return values.map((value, index) => (
    <span key={value}>
      {index > 0 ? ', ' : null}
      <ChoiceText path={`${prefix}.${value}`} fallback={value} />
    </span>
  ));
}

function ChoiceText({ path, fallback }: { path: string; fallback: string }) {
  const messages = useMessages();
  const choices = messages.onboarding;
  const value =
    choices && typeof choices === 'object' && 'choices' in choices
      ? readMessage(choices.choices, path)
      : null;
  return value ?? fallback;
}

function readMessage(source: unknown, path: string): string | null {
  let current = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}

function Section({
  title,
  children,
  className = 'mt-8 border border-line px-4 py-4',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-4 font-heading text-lg text-ink uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-sm break-words text-ink">{value}</dd>
    </div>
  );
}

function formatDate(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCalendarDate(locale: string, value: string) {
  // Date-only strings parse as UTC midnight, so a local zone west of UTC
  // would show the previous calendar day.
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatHeight(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value,
  );
}
