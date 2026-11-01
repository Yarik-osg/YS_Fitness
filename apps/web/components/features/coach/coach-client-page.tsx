'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type {
  CoachClientDetail,
  CoachClientOnboarding,
  TrainerProgramTemplateSummary,
} from '@repo/shared-types';
import { COACH_NOTE_MAX_LENGTH } from '@repo/validation';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { CoachClientHistory } from '@/components/features/coach/coach-client-history';
import { programCatalogName } from '@/lib/program-catalog-name';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { exportCoachClient } from '@/lib/api/coach';
import { roundHalfAwayFromZero } from '@/lib/nutrition-display';
import {
  useApplyNutritionCalculation,
  useAssignCoachProgram,
  useCoachClient,
  useCoachNutrition,
  useGrantClientAccess,
  useSetManualNutritionTarget,
  useUpdateCoachNote,
} from '@/lib/hooks/use-coach-clients';
import { useCoachPrograms } from '@/lib/hooks/use-coach-programs';
import { usePlans } from '@/lib/hooks/use-subscriptions';
import { exportDay, saveBlob } from '@/lib/save-blob';

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

      {client.data ? (
        <ClientDetail detail={client.data} onReload={() => client.refetch()} />
      ) : null}
    </main>
  );
}

function ClientDetail({
  detail,
  onReload,
}: {
  detail: CoachClientDetail;
  onReload: () => Promise<unknown>;
}) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const title = detail.program
    ? programCatalogName({ name: detail.program.templateName })
    : null;
  const joined = formatDate(locale, detail.createdAt);

  async function downloadExport() {
    if (exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const filename = `ys-fitness-client-${exportDay()}.xlsx`;
      const blob = await exportCoachClient(detail.id);
      saveBlob(blob, filename);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl leading-none text-ink">
          {detail.name?.trim() ? detail.name : t('unnamed')}
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg whitespace-nowrap"
          disabled={exporting}
          onClick={() => void downloadExport()}
        >
          {exporting ? t('exporting') : t('exportExcel')}
        </Button>
      </div>
      {exportError ? (
        <p role="alert" className="mt-4 text-sm text-amber">
          {t('exportError')}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-ink">{detail.email}</p>
      <p className="mt-1 text-sm text-muted">
        {t('joined')} {joined}
      </p>
      {detail.archived ? (
        <p className="mt-2 text-sm text-muted">{t('archived')}</p>
      ) : null}
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

      <Section title={t('sections.profile')} plain>
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

      <Section title={t('sections.questionnaire')} plain>
        {detail.onboarding ? (
          <Answers answers={detail.onboarding} />
        ) : (
          <p className="text-sm text-muted">{t('noOnboarding')}</p>
        )}
      </Section>

      <CoachNutrition userId={detail.id} />

      <Section title={t('sections.program')} plain>
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

      <CoachNote userId={detail.id} note={detail.note} onReload={onReload} />

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
        <AccessGrant detail={detail} />
      </Section>

      <CoachClientHistory userId={detail.id} />
    </>
  );
}

function CoachNutrition({ userId }: { userId: string }) {
  const t = useTranslations('coach');
  const nutrition = useCoachNutrition(userId);
  const manual = useSetManualNutritionTarget(userId);
  const apply = useApplyNutritionCalculation(userId);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [invalid, setInvalid] = useState(false);
  const calculation = nutrition.data?.calculation ?? null;
  const target = nutrition.data?.target ?? null;
  const applied =
    target?.source === 'CALCULATED' && target.calculationId === calculation?.id;

  function syncCalories(
    proteinValue: string,
    fatValue: string,
    carbValue: string,
  ) {
    const kcal = caloriesFromMacros(proteinValue, fatValue, carbValue);
    if (kcal !== null) setCalories(kcal);
  }

  function saveManual() {
    const body = {
      targetCalories: amount(calories),
      proteinGrams: amount(protein),
      fatGrams: amount(fat),
      carbsGrams: amount(carbs, true),
    };
    if (
      !body.targetCalories ||
      Number(body.targetCalories) <= 0 ||
      !body.proteinGrams ||
      !body.fatGrams ||
      !body.carbsGrams
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    manual.mutate({
      targetCalories: body.targetCalories,
      proteinGrams: body.proteinGrams,
      fatGrams: body.fatGrams,
      carbsGrams: body.carbsGrams,
    });
  }

  return (
    <Section title={t('sections.nutrition')}>
      {nutrition.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {nutrition.isError ? (
        <p className="text-sm text-amber">{t('nutritionError')}</p>
      ) : null}
      {nutrition.isPending ? null : (
        <>
          <h3 className="font-heading text-sm text-ink">{t('nutritionNow')}</h3>
          {target ? (
            <p className="mt-2 text-sm text-ink">
              {t('nutritionFigures', figureValues(target))}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('nutritionNowEmpty')}</p>
          )}
          {target ? (
            <p className="mt-1 text-sm text-muted">
              {target.source === 'MANUAL'
                ? t('nutritionNowManual')
                : t('nutritionNowCalculated')}
            </p>
          ) : null}
          {calculation && !applied ? (
            <div className="mt-6">
              <h3 className="font-heading text-sm text-ink">
                {t('nutritionFormula')}
              </h3>
              <p className="mt-2 text-sm text-ink">
                {t('nutritionFigures', figureValues(calculation))}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t('nutritionFormulaIdle')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-lg whitespace-nowrap"
                disabled={apply.isPending}
                onClick={() => apply.mutate(calculation.id)}
              >
                {apply.isPending ? t('nutritionApplying') : t('nutritionApply')}
              </Button>
            </div>
          ) : null}
          {!calculation ? (
            <p className="mt-2 text-sm text-muted">{t('nutritionNone')}</p>
          ) : null}
          <div className="mt-6">
            <h3 className="font-heading text-sm text-ink">
              {t('nutritionOwn')}
            </h3>
            <p className="mt-1 text-sm text-muted">{t('nutritionOwnHint')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MacroField
                label={t('nutritionCalories')}
                value={calories}
                onChange={setCalories}
              />
              <MacroField
                label={t('nutritionProtein')}
                value={protein}
                onChange={(value) => {
                  setProtein(value);
                  syncCalories(value, fat, carbs);
                }}
              />
              <MacroField
                label={t('nutritionFat')}
                value={fat}
                onChange={(value) => {
                  setFat(value);
                  syncCalories(protein, value, carbs);
                }}
              />
              <MacroField
                label={t('nutritionCarbs')}
                value={carbs}
                onChange={(value) => {
                  setCarbs(value);
                  syncCalories(protein, fat, value);
                }}
              />
            </div>
            {invalid ? (
              <p role="alert" className="mt-3 text-sm text-amber">
                {t('nutritionInvalid')}
              </p>
            ) : null}
            {manual.isError || apply.isError ? (
              <p role="alert" className="mt-3 text-sm text-amber">
                {t('nutritionError')}
              </p>
            ) : null}
            <Button
              size="sm"
              className="mt-4 rounded-lg whitespace-nowrap"
              disabled={manual.isPending}
              onClick={saveManual}
            >
              {manual.isPending
                ? t('nutritionSaving')
                : t('nutritionManualSave')}
            </Button>
          </div>
        </>
      )}
    </Section>
  );
}

function figureValues(row: {
  targetCalories: string;
  proteinGrams: string;
  fatGrams: string;
  carbsGrams: string;
}) {
  return {
    calories: roundHalfAwayFromZero(row.targetCalories),
    protein: roundHalfAwayFromZero(row.proteinGrams),
    fat: roundHalfAwayFromZero(row.fatGrams),
    carbs: roundHalfAwayFromZero(row.carbsGrams),
  };
}

function caloriesFromMacros(protein: string, fat: string, carbs: string) {
  const proteinAmount = amount(protein);
  const fatAmount = amount(fat);
  const carbAmount = amount(carbs, true);
  if (!proteinAmount || !fatAmount || !carbAmount) return null;
  const total =
    scaled(proteinAmount) * 4n +
    scaled(carbAmount) * 4n +
    scaled(fatAmount) * 9n;
  return unscaled(total);
}

function scaled(value: string) {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const digits = BigInt(`${whole}${fraction.padEnd(4, '0')}`);
  return negative ? -digits : digits;
}

function unscaled(value: bigint) {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(5, '0');
  const whole = digits.slice(0, -4).replace(/^0+(?=\d)/, '');
  const fraction = digits.slice(-4).replace(/0+$/, '');
  const text = fraction ? `${whole}.${fraction}` : whole;
  return negative && text !== '0' ? `-${text}` : text;
}

function amount(value: string, signed = false) {
  const text = value.trim().replace(',', '.');
  const pattern = signed ? /^-?\d{1,6}(\.\d{1,4})?$/ : /^\d{1,6}(\.\d{1,4})?$/;
  return pattern.test(text) ? text : null;
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-ink">
      {label}
      <input
        value={value}
        inputMode="decimal"
        aria-label={label}
        className="mt-2 h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function savedNote(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('isSuccess' in result)) {
    return null;
  }
  if (result.isSuccess !== true) return null;
  if (!('data' in result) || !result.data || typeof result.data !== 'object') {
    return null;
  }
  if (!('note' in result.data) || typeof result.data.note !== 'string') {
    return null;
  }
  return result.data.note;
}

function CoachNote({
  userId,
  note,
  onReload,
}: {
  userId: string;
  note: string;
  onReload: () => Promise<unknown>;
}) {
  const t = useTranslations('coach');
  const save = useUpdateCoachNote(userId);
  const [base, setBase] = useState(note);
  const [draft, setDraft] = useState(note);
  const [seen, setSeen] = useState(note);
  const [reloadError, setReloadError] = useState(false);
  const [reloading, setReloading] = useState(false);
  const dirty = draft !== base;

  if (note !== seen) {
    setSeen(note);
    if (draft === base) {
      setBase(note);
      setDraft(note);
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const conflict =
    save.error instanceof ApiClientError && save.error.status === 409;

  async function reload() {
    setReloading(true);
    setReloadError(false);
    try {
      const next = savedNote(await onReload());
      if (next === null) {
        setReloadError(true);
        return;
      }
      setBase(next);
      setDraft(next);
    } catch {
      setReloadError(true);
    } finally {
      setReloading(false);
    }
  }

  return (
    <Section title={t('noteLabel')}>
      <p className="text-sm text-muted">{t('noteHint')}</p>
      <textarea
        value={draft}
        maxLength={COACH_NOTE_MAX_LENGTH}
        aria-label={t('noteLabel')}
        placeholder={t('notePlaceholder')}
        disabled={save.isPending}
        onChange={(event) => setDraft(event.target.value)}
        className="mt-3 min-h-28 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          className="rounded-lg whitespace-nowrap"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate(
              { note: draft, base },
              {
                onSuccess: (detail) => {
                  setBase(detail.note);
                  setDraft(detail.note);
                },
              },
            )
          }
        >
          {save.isPending ? t('noteSaving') : t('noteSave')}
        </Button>
        {save.isSuccess && !dirty ? (
          <p className="text-sm text-muted">{t('noteSaved')}</p>
        ) : null}
      </div>
      {save.isError ? (
        <p role="alert" className="mt-3 text-sm text-amber">
          {conflict ? t('noteConflict') : t('noteError')}
        </p>
      ) : null}
      {reloadError ? (
        <p role="alert" className="mt-3 text-sm text-amber">
          {t('noteReloadError')}
        </p>
      ) : null}
      {conflict ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 rounded-lg whitespace-nowrap"
          disabled={reloading}
          onClick={() => void reload()}
        >
          {t('retry')}
        </Button>
      ) : null}
    </Section>
  );
}

function AccessGrant({ detail }: { detail: CoachClientDetail }) {
  const t = useTranslations('coach');
  const plans = usePlans();
  const grant = useGrantClientAccess(detail.id);
  const [planId, setPlanId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const choices = plans.data ?? [];
  const selected =
    choices.find((plan) => plan.id === planId) ?? choices[0] ?? null;
  const blocked =
    detail.subscription?.active === true ||
    detail.subscription?.status === 'PENDING';

  return (
    <div className="mt-4">
      {detail.subscription?.status === 'PENDING' ? (
        <p className="text-sm text-muted">{t('grantPending')}</p>
      ) : null}
      {blocked ? null : (
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg whitespace-nowrap"
          disabled={plans.isPending || choices.length === 0 || grant.isPending}
          onClick={() => {
            grant.reset();
            setOpen(true);
          }}
        >
          {t('grantAccess')}
        </Button>
      )}
      <Sheet
        open={open}
        dismissible={!grant.isPending}
        onOpenChange={(next) => {
          if (!next && !grant.isPending) setOpen(false);
        }}
      >
        <SheetContent>
          <SheetTitle>{t('grantTitle')}</SheetTitle>
          <SheetDescription>
            {t('grantBody', {
              duration: t('grantMonths', {
                count: selected?.intervalMonths ?? 0,
              }),
            })}
          </SheetDescription>
          {choices.length > 1 ? (
            <label className="mb-4 block text-sm text-ink">
              {t('grantPlan')}
              <select
                value={selected?.id ?? ''}
                aria-label={t('grantPlan')}
                className="mt-2 h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink"
                onChange={(event) => setPlanId(event.target.value)}
              >
                {choices.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
          ) : selected ? (
            <p className="mb-4 text-center text-sm text-ink">{selected.name}</p>
          ) : null}
          {grant.isError ? (
            <p role="alert" className="mb-4 text-center text-sm text-amber">
              {grant.error instanceof ApiClientError &&
              grant.error.status === 409
                ? t('grantConflict')
                : t('grantError')}
            </p>
          ) : null}
          <SheetFooter>
            <Button
              className="whitespace-nowrap"
              disabled={grant.isPending || !selected}
              onClick={() => {
                if (!selected) return;
                grant.mutate(selected.id, { onSuccess: () => setOpen(false) });
              }}
            >
              {grant.isPending ? t('grantSaving') : t('grantConfirm')}
            </Button>
            <Button
              variant="outline"
              disabled={grant.isPending}
              onClick={() => setOpen(false)}
            >
              {t('archiveCancel')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
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

function Section({
  title,
  children,
  plain = false,
}: {
  title: string;
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <section
      className={
        plain ? 'mt-8' : 'mt-8 rounded-lg border border-line bg-panel px-4 py-4'
      }
    >
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
