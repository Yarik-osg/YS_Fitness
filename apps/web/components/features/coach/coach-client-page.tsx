'use client';

import { useState, type ReactNode } from 'react';
import type {
  CoachClientDetail,
  CoachClientOnboarding,
  TrainerProgramTemplateSummary,
} from '@repo/shared-types';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { CoachClientHistory } from '@/components/features/coach/coach-client-history';
import { programCatalogName } from '@/lib/program-catalog-name';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import {
  useAssignCoachProgram,
  useCoachClient,
} from '@/lib/hooks/use-coach-clients';
import { useCoachPrograms } from '@/lib/hooks/use-coach-programs';

export function CoachClientPage({ userId }: { userId: string }) {
  const t = useTranslations('coach');
  const client = useCoachClient(userId);
  const notFound =
    client.error instanceof ApiClientError && client.error.status === 404;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <Link
        href="/coach"
        className="text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors"
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
            className="rounded-lg whitespace-nowrap"
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
  const title = detail.program
    ? programCatalogName({ name: detail.program.templateName })
    : null;
  const joined = formatDate(locale, detail.createdAt);

  return (
    <>
      <h1 className="mt-4 font-heading text-3xl leading-none text-ink">
        {detail.name?.trim() ? detail.name : t('unnamed')}
      </h1>
      <p className="mt-3 text-sm text-ink">{detail.email}</p>
      <p className="mt-1 text-sm text-muted">
        {t('joined')} {joined}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill
          label={t('onboarding')}
          on={detail.onboardingCompleted}
          yes={t('onboardingDone')}
          no={t('onboardingMissing')}
        />
        <StatusPill
          label={t('program')}
          on={detail.program !== null}
          yes={t('programAssigned')}
          no={t('programMissing')}
        />
        <StatusPill
          label={t('subscription')}
          on={detail.subscription?.active === true}
          yes={t('subscriptionActive')}
          no={
            detail.subscription
              ? t('subscriptionInactive')
              : t('noSubscription')
          }
        />
      </div>

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

      <Section title={t('sections.program')}>
        {detail.program ? (
          <div>
            <p className="text-xs text-muted">
              {detail.program.origin === 'SYSTEM'
                ? t('catalog.system')
                : t('catalog.custom')}
              {' · '}
              {detail.program.assignmentSource === 'ADMIN'
                ? t('catalog.pinned')
                : t('catalog.matched')}
            </p>
            <h2 className="mt-2 font-heading text-xl text-ink">{title}</h2>
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
        <ProgramAssign userId={detail.id} currentName={title} />
      </Section>

      <Section title={t('sections.subscription')}>
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
              {subscriptionStatusLabel(detail.subscription, t)}
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

function subscriptionStatusLabel(
  subscription: NonNullable<CoachClientDetail['subscription']>,
  t: ReturnType<typeof useTranslations<'coach'>>,
) {
  // A lapsed ACTIVE row has not been expired in the database. Say so
  // without calling the period current.
  if (!subscription.active && subscription.status === 'ACTIVE') {
    return t('status.EXPIRED');
  }
  return t(`status.${subscription.status}`);
}

function StatusPill({
  label,
  on,
  yes,
  no,
}: {
  label: string;
  on: boolean;
  yes: string;
  no: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-muted">{label}</span>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
          on ? 'bg-lime/10 text-lime' : 'text-muted'
        }`}
      >
        {on ? yes : no}
      </span>
    </span>
  );
}

function ProgramAssign({
  userId,
  currentName,
}: {
  userId: string;
  currentName: string | null;
}) {
  const t = useTranslations('coach');
  const [open, setOpen] = useState(false);
  const programs = useCoachPrograms(open);
  const assign = useAssignCoachProgram(userId);
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<TrainerProgramTemplateSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const templates = (programs.data?.templates ?? []).filter(
    (template) => template.active,
  );
  const needle = query.trim().toLocaleLowerCase();
  const visible = templates.filter((template) =>
    programCatalogName(template).toLocaleLowerCase().includes(needle),
  );

  function closePicker() {
    setOpen(false);
    setChoice(null);
    setQuery('');
    setError(null);
  }

  function submit(templateId: string) {
    setError(null);
    assign.mutate(templateId, {
      onSuccess: () => {
        setOpen(false);
        setChoice(null);
        setQuery('');
      },
      onError: (caught) => {
        setError(assignErrorMessage(caught, t));
      },
    });
  }

  return (
    <div className="mt-4">
      <Button
        size="sm"
        className="rounded-lg whitespace-nowrap"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
      >
        {currentName ? t('catalog.replaceProgram') : t('catalog.assignProgram')}
      </Button>
      {open ? (
        <div className="mt-4">
          <input
            type="search"
            value={query}
            aria-label={t('catalog.searchPrograms')}
            placeholder={t('catalog.searchPrograms')}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {programs.isError ? (
            <p role="alert" className="mt-3 text-sm text-amber">
              {t('catalog.loadError')}
            </p>
          ) : null}
          <ul className="mt-3 max-h-60 overflow-auto">
            {visible.map((template) => (
              <li
                key={template.id}
                className="border-b border-line last:border-b-0"
              >
                <button
                  type="button"
                  disabled={assign.isPending}
                  className="flex w-full min-w-0 items-baseline gap-3 py-2 text-left text-sm whitespace-nowrap text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45"
                  onClick={() => {
                    if (currentName) {
                      setChoice(template);
                      return;
                    }
                    submit(template.id);
                  }}
                >
                  <span className="min-w-0 truncate font-medium">
                    {programCatalogName(template)}
                  </span>
                  <span className="shrink-0 text-muted">
                    {template.origin === 'SYSTEM'
                      ? t('catalog.system')
                      : t('catalog.custom')}
                    {' · '}
                    {t(`catalog.levels.${template.level}`)}
                    {' · '}
                    {t('catalog.days')} {template.dayCount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {visible.length === 0 && programs.data ? (
            <p className="mt-3 text-sm text-muted">
              {t('catalog.filterEmpty')}
            </p>
          ) : null}
          {choice ? (
            <div className="mt-4 flex flex-col items-start gap-3">
              <p className="text-sm text-ink">
                {t('catalog.replaceConfirm', {
                  name: programCatalogName(choice),
                })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  className="rounded-lg whitespace-nowrap"
                  disabled={assign.isPending}
                  onClick={() => submit(choice.id)}
                >
                  {assign.isPending
                    ? t('catalog.assigningProgram')
                    : t('catalog.replaceProgram')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg whitespace-nowrap"
                  onClick={() => setChoice(null)}
                >
                  {t('catalog.cancel')}
                </Button>
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-amber">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-lg whitespace-nowrap"
            onClick={closePicker}
          >
            {t('catalog.close')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function assignErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations<'coach'>>,
) {
  if (error instanceof ApiClientError) {
    if (error.code === 'TEMPLATE_INACTIVE')
      return t('catalog.templateInactive');
    if (error.code === 'TEMPLATE_NOT_FOUND') return t('catalog.notFound');
    if (error.code === 'CLIENT_NOT_FOUND') return t('notFound');
    if (error.status < 500 && error.message) return error.message;
  }
  return t('catalog.assignError');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 rounded-lg border border-line bg-panel px-4 py-4">
      <h2 className="mb-4 font-heading text-base text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
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
