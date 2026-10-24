'use client';

// Authenticated blob URLs are not a remote pattern next/image can optimize.
/* eslint-disable @next/next/no-img-element */

import type {
  CoachClientWorkoutLog,
  CoachClientWorkoutSet,
  CoachClientWorkoutsResponse,
  ProgressPhoto,
  ProgressPhotosResponse,
  StrengthChange,
  StrengthChangesResponse,
  WeightMeasurementsResponse,
} from '@repo/shared-types';
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from '@tanstack/react-query';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { WeightChart } from '@/components/features/progress/weight-chart';
import { Button } from '@/components/ui/button';
import { Collapse } from '@/components/ui/collapse';
import { Skeleton } from '@/components/ui/skeleton';
import { getCoachProgressPhotoBlob } from '@/lib/api/coach';
import { exerciseName } from '@/lib/exercise-name';
import {
  useCoachMeasurements,
  useCoachProgressPhotos,
  useCoachStrength,
  useCoachWorkouts,
} from '@/lib/hooks/use-coach-clients';
import {
  formatDelta,
  formatWeight,
  latestMeasurement,
} from '@/lib/weight-chart';

export function CoachClientHistory({ userId }: { userId: string }) {
  const workouts = useCoachWorkouts(userId);
  const measurements = useCoachMeasurements(userId);
  const strength = useCoachStrength(userId);
  const photos = useCoachProgressPhotos(userId);

  return (
    <>
      <WorkoutSection userId={userId} query={workouts} />
      <MeasurementSection query={measurements} />
      <StrengthSection userId={userId} query={strength} />
      <PhotoSection userId={userId} query={photos} />
    </>
  );
}

function WorkoutSection({
  userId,
  query,
}: {
  userId: string;
  query: UseInfiniteQueryResult<InfiniteData<CoachClientWorkoutsResponse>>;
}) {
  const t = useTranslations('coach');
  const pages = useHeldPages(userId, query.data?.pages);
  const logs = uniqueLogs(pages);
  const [scope, setScope] = useState(userId);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  if (scope !== userId) {
    setScope(userId);
    setPicked(undefined);
  }
  const openId = picked === undefined ? (logs[0]?.id ?? null) : picked;

  return (
    <HistorySection title={t('sections.workouts')}>
      <SectionBody
        pending={query.isPending && logs.length === 0}
        error={query.isError && logs.length === 0}
        onRetry={() => void query.refetch()}
        empty={logs.length === 0}
        emptyText={t('noWorkouts')}
      >
        <div className="flex flex-col gap-4">
          {logs.map((log) => (
            <SessionLog
              key={log.id}
              log={log}
              open={log.id === openId}
              onToggle={() =>
                setPicked((current) => {
                  const selected =
                    current === undefined ? (logs[0]?.id ?? null) : current;
                  return selected === log.id ? null : log.id;
                })
              }
            />
          ))}
        </div>
        {query.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 rounded-lg"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
          </Button>
        ) : null}
        {query.isFetchNextPageError ? (
          <p role="alert" className="mt-4 text-sm text-amber">
            {t('historyError')}{' '}
            <button
              type="button"
              className="underline decoration-line underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => void query.fetchNextPage()}
            >
              {t('retry')}
            </button>
          </p>
        ) : null}
      </SectionBody>
    </HistorySection>
  );
}

function MeasurementSection({
  query,
}: {
  query: UseQueryResult<WeightMeasurementsResponse>;
}) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const points = query.data?.measurements ?? [];
  const latest = latestMeasurement(points);

  return (
    <HistorySection title={t('sections.measurements')} compact>
      <SectionBody
        pending={query.isPending && !query.data}
        error={query.isError && !query.data}
        onRetry={() => void query.refetch()}
        empty={points.length === 0}
        emptyText={t('noMeasurements')}
      >
        {latest ? (
          <p className="mb-4 font-heading text-3xl leading-none text-ink tabular-nums">
            {formatWeight(locale, latest.weightKg)}{' '}
            <span className="text-sm font-normal text-muted">{t('kg')}</span>
          </p>
        ) : null}
        <WeightChart points={points} label={t('chartLabel')} unit={t('kg')} />
      </SectionBody>
    </HistorySection>
  );
}

function StrengthSection({
  userId,
  query,
}: {
  userId: string;
  query: UseQueryResult<StrengthChangesResponse>;
}) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const changes = query.data?.changes ?? [];
  const [scope, setScope] = useState(userId);
  const [open, setOpen] = useState(false);
  if (scope !== userId) {
    setScope(userId);
    setOpen(false);
  }
  const preview = changes.slice(0, STRENGTH_PREVIEW);
  const rest = changes.slice(STRENGTH_PREVIEW);

  return (
    <HistorySection title={t('sections.strength')}>
      <SectionBody
        pending={query.isPending && !query.data}
        error={query.isError && !query.data}
        onRetry={() => void query.refetch()}
        empty={changes.length === 0}
        emptyText={t('noStrength')}
      >
        <div className="divide-y divide-line">
          {preview.map((change) => (
            <StrengthRow
              key={change.exerciseId}
              change={change}
              locale={locale}
            />
          ))}
          {rest.length > 0 ? (
            <>
              <Collapse open={open} id="coach-strength-rest">
                <div className="divide-y divide-line">
                  {rest.map((change) => (
                    <StrengthRow
                      key={change.exerciseId}
                      change={change}
                      locale={locale}
                    />
                  ))}
                </div>
              </Collapse>
              <ShowMore
                open={open}
                controls="coach-strength-rest"
                onToggle={() => setOpen((current) => !current)}
              />
            </>
          ) : null}
        </div>
      </SectionBody>
    </HistorySection>
  );
}

function PhotoSection({
  userId,
  query,
}: {
  userId: string;
  query: UseQueryResult<ProgressPhotosResponse>;
}) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const photos = query.data?.photos;
  const { urls, failed } = usePrivatePhotoUrls(
    userId,
    query.isSuccess ? photos : undefined,
  );

  return (
    <HistorySection title={t('sections.photos')} compact>
      <SectionBody
        pending={query.isPending && !query.data}
        error={query.isError && !query.data}
        onRetry={() => void query.refetch()}
        empty={!photos || photos.length === 0}
        emptyText={t('noPhotos')}
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(photos ?? []).map((photo) => (
            <li key={photo.id} className="min-w-0">
              {urls[photo.id] ? (
                <img
                  src={urls[photo.id]}
                  alt={formatWhen(locale, photo.createdAt)}
                  className="aspect-[3/4] w-full rounded-lg border border-line object-cover"
                />
              ) : failed[photo.id] ? (
                <p className="flex aspect-[3/4] items-center text-sm text-amber">
                  {t('photoFailed')}
                </p>
              ) : (
                <Skeleton className="aspect-[3/4] w-full rounded-lg" />
              )}
            </li>
          ))}
        </ul>
      </SectionBody>
    </HistorySection>
  );
}

function HistorySection({
  title,
  children,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={
        compact
          ? 'mt-10'
          : 'mt-8 rounded-lg border border-line bg-panel px-4 py-4'
      }
    >
      <h2
        className={`font-heading text-base text-ink ${compact ? 'mb-3' : 'mb-4'}`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function SectionBody({
  pending,
  error,
  onRetry,
  empty,
  emptyText,
  children,
}: {
  pending: boolean;
  error: boolean;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  const t = useTranslations('coach');
  if (pending) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-amber">
        {t('historyError')}{' '}
        <button
          type="button"
          className="underline decoration-line underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onRetry}
        >
          {t('retry')}
        </button>
      </p>
    );
  }
  if (empty) return <p className="text-sm text-muted">{emptyText}</p>;
  return children;
}

function StrengthRow({
  change,
  locale,
}: {
  change: StrengthChange;
  locale: string;
}) {
  const t = useTranslations('coach');
  const deltaKg = change.toKg - change.fromKg;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-sm text-ink">{exerciseName(change, locale)}</p>
        <p className="flex items-center gap-1.5 font-heading text-sm tabular-nums">
          <span className="text-muted">
            {formatWeight(locale, change.fromKg)} {t('kg')}
          </span>
          <ArrowRight aria-hidden="true" className="size-3.5 text-muted" />
          <span>
            {formatWeight(locale, change.toKg)} {t('kg')}
          </span>
        </p>
      </div>
      <p
        className={`rounded-md border px-2 py-0.5 font-heading text-sm tabular-nums ${
          deltaKg < 0
            ? 'border-amber/30 text-amber'
            : 'border-teal/30 text-teal'
        }`}
      >
        {formatDelta(locale, deltaKg)}
      </p>
    </div>
  );
}

const EXERCISE_PREVIEW = 4;
const STRENGTH_PREVIEW = 3;

function SessionLog({
  log,
  open,
  onToggle,
}: {
  log: CoachClientWorkoutLog;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const groups = exerciseGroups(log.sets);
  const panelId = `session-${log.id}`;

  return (
    <article
      className={`min-w-0 rounded-lg px-3 py-3 ${open ? 'bg-[var(--color-wash)]' : ''}`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span>
          <span className="block text-sm whitespace-nowrap text-ink tabular-nums">
            {formatSessionDate(locale, log.completedAt)}
          </span>
          <span className="mt-1 block text-sm whitespace-nowrap text-muted">
            {t('day', { day: log.dayNumber })}
            {' · '}
            {t('exerciseCount', { count: groups.length })}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`mt-0.5 size-4 shrink-0 text-muted motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Collapse open={open} id={panelId}>
        <ExerciseList logId={log.id} groups={groups} />
      </Collapse>
    </article>
  );
}

function ExerciseList({
  logId,
  groups,
}: {
  logId: string;
  groups: CoachClientWorkoutSet[][];
}) {
  const [open, setOpen] = useState(false);
  const preview = groups.slice(0, EXERCISE_PREVIEW);
  const rest = groups.slice(EXERCISE_PREVIEW);
  const restId = `session-${logId}-rest`;

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      {preview.map((group) => (
        <ExerciseGroup key={group[0]?.order} group={group} />
      ))}
      {rest.length > 0 ? (
        <>
          <Collapse open={open} id={restId}>
            <div className="flex flex-col gap-3">
              {rest.map((group) => (
                <ExerciseGroup key={group[0]?.order} group={group} />
              ))}
            </div>
          </Collapse>
          <ShowMore
            open={open}
            controls={restId}
            onToggle={() => setOpen((current) => !current)}
          />
        </>
      ) : null}
    </div>
  );
}

function ExerciseGroup({ group }: { group: CoachClientWorkoutSet[] }) {
  const t = useTranslations('coach');
  const locale = useLocale();
  const exercise = group[0]?.exercise;
  if (!exercise) return null;

  return (
    <div className="min-w-0">
      <p className="text-sm text-ink">{exerciseName(exercise, locale)}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {group.map((set) => (
          <li
            key={`${set.order}-${set.setNumber}`}
            className="flex items-baseline justify-between gap-4 text-sm tabular-nums"
          >
            <span className="text-muted">
              {t('reps', { count: set.repsCompleted })}
            </span>
            {set.weightKg === null ? null : (
              <span className="text-ink">
                {formatWeight(locale, set.weightKg)} {t('kg')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShowMore({
  open,
  controls,
  onToggle,
}: {
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const t = useTranslations('coach');
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="mt-3 inline-flex items-center gap-1 self-start text-xs whitespace-nowrap text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-colors"
    >
      {open ? t('showLess') : t('showMore')}
      <ChevronDown
        aria-hidden="true"
        className={`size-3.5 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

function exerciseGroups(sets: CoachClientWorkoutSet[]) {
  const groups: CoachClientWorkoutSet[][] = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (last?.[0]?.order === set.order) last.push(set);
    else groups.push([set]);
  }
  return groups;
}

function useHeldPages(
  userId: string,
  pages: { logs: CoachClientWorkoutLog[] }[] | undefined,
) {
  const [scope, setScope] = useState(userId);
  const [held, setHeld] = useState(pages);
  const switched = scope !== userId;
  if (switched) {
    setScope(userId);
    setHeld(undefined);
  } else if (pages && pages !== held) {
    setHeld(pages);
  }
  return switched ? undefined : (pages ?? held);
}

function uniqueLogs(pages: { logs: CoachClientWorkoutLog[] }[] | undefined) {
  const seen = new Set<string>();
  const logs: CoachClientWorkoutLog[] = [];
  for (const page of pages ?? []) {
    for (const log of page.logs) {
      if (seen.has(log.id)) continue;
      seen.add(log.id);
      logs.push(log);
    }
  }
  return logs;
}

function formatSessionDate(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatWhen(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function usePrivatePhotoUrls(
  userId: string,
  photos: ProgressPhoto[] | undefined,
) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [scope, setScope] = useState(userId);
  const owned = useRef<string[]>([]);
  const seenUser = useRef(userId);
  const ids = (photos ?? []).map((photo) => photo.id).join('\0');

  if (scope !== userId) {
    setScope(userId);
    setUrls({});
    setFailed({});
  }

  useEffect(() => {
    const list = photos ?? [];
    let cancelled = false;
    const created: string[] = [];
    if (seenUser.current !== userId) {
      seenUser.current = userId;
      owned.current.forEach((url) => URL.revokeObjectURL(url));
      owned.current = [];
    }

    void (async () => {
      const next: Record<string, string> = {};
      const nextFailed: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (photo) => {
          try {
            const blob = await getCoachProgressPhotoBlob(userId, photo.id);
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            created.push(url);
            next[photo.id] = url;
          } catch {
            if (!cancelled) nextFailed[photo.id] = true;
          }
        }),
      );
      if (cancelled) {
        created.forEach((url) => {
          if (!owned.current.includes(url)) URL.revokeObjectURL(url);
        });
        return;
      }
      owned.current.forEach((url) => URL.revokeObjectURL(url));
      owned.current = created;
      setUrls(next);
      setFailed(nextFailed);
    })();

    return () => {
      cancelled = true;
      created.forEach((url) => {
        if (!owned.current.includes(url)) URL.revokeObjectURL(url);
      });
    };
  }, [ids, photos, userId]);

  useEffect(() => {
    const urls = owned;
    return () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = [];
    };
  }, []);

  if (scope !== userId) return { urls: {}, failed: {} };
  return { urls, failed };
}
