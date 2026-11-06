'use client';

import type {
  FoodDayResponse,
  FoodLogEntryResponse,
  FoodMeal,
} from '@repo/shared-types';
import { FOOD_MEALS, isCalendarDate } from '@repo/validation';
import { ChevronLeft, ChevronRight, Heart, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AddFoodSheet } from '@/components/features/food/add-food-sheet';
import { EditEntrySheet } from '@/components/features/food/edit-entry-sheet';
import { FoodImage } from '@/components/features/food/food-image';
import { ClientNav } from '@/components/features/shell/client-nav';
import { LockedProgramScreen } from '@/components/features/subscription/locked-screen';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { localDateKey } from '@/lib/calendar';
import {
  formatFoodDate,
  selectedFoodDate,
  shiftFoodDate,
} from '@/lib/food/dates';
import { decodeFoodText } from '@/lib/food/text';
import {
  formatFoodAmount,
  goalState,
  mealSubtotal,
  targetAsTotals,
} from '@/lib/food/macros';
import {
  useDeleteFoodLog,
  useFoodDay,
  useToggleFavorite,
} from '@/lib/hooks/use-food';
import {
  useCalculateNutrition,
  useNutritionCalculations,
} from '@/lib/hooks/use-nutrition';
import { shownNutrition } from '@/lib/nutrition-display';

export function FoodPage() {
  const t = useTranslations('food');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const [now] = useState(() => new Date());
  const date = selectedFoodDate(params.get('date'), now);
  const day = useFoodDay(date);
  const [adding, setAdding] = useState<FoodMeal | null>(null);
  const [editing, setEditing] = useState<FoodLogEntryResponse | null>(null);
  const [deleting, setDeleting] = useState<FoodLogEntryResponse | null>(null);
  const today = localDateKey(now);

  function setDate(next: string) {
    router.replace(`/nutrition?date=${next}`);
  }

  if (
    day.error instanceof ApiClientError &&
    day.error.code === 'SUBSCRIPTION_REQUIRED'
  ) {
    return (
      <LockedProgramScreen nav="nutrition">
        <FoodSkeleton />
      </LockedProgramScreen>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-24 text-ink">
      <header className="border-b border-line px-5 pt-6 pb-3">
        <h1 className="font-heading text-[28px] leading-none text-ink uppercase">
          {t('title')}
        </h1>
        <div className="mt-3 flex items-center justify-between gap-2">
          <IconButton
            label={t('previousDay')}
            onClick={() => setDate(shiftFoodDate(date, -1))}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <div className="min-w-0 text-center">
            <p className="font-heading text-xl text-ink">
              {formatFoodDate(date, locale)}
            </p>
            {date === today ? (
              <p className="text-xs text-teal">{t('today')}</p>
            ) : (
              <button
                type="button"
                onClick={() => setDate(today)}
                className="text-xs text-teal"
              >
                {t('today')}
              </button>
            )}
          </div>
          <IconButton
            label={t('nextDay')}
            onClick={() => setDate(shiftFoodDate(date, 1))}
          >
            <ChevronRight size={18} />
          </IconButton>
        </div>
        <input
          type="date"
          aria-label={t('date')}
          value={date}
          onChange={(event) => {
            if (isCalendarDate(event.target.value)) setDate(event.target.value);
          }}
          className="mt-2 min-h-11 w-full border border-line bg-panel px-2 text-sm text-ink"
        />
      </header>
      <div className="flex flex-col gap-4 px-4 pt-4">
        {day.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : day.isError ? (
          <div className="border border-line bg-panel p-4">
            <p role="alert" className="text-sm text-amber">
              {t('loadError')}
            </p>
            <Button className="mt-3" onClick={() => void day.refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <>
            <DayProgress day={day.data} />
            {day.data.entries.length === 0 ? (
              <p className="text-sm text-muted">{t('emptyDay')}</p>
            ) : null}
            {FOOD_MEALS.map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={day.data.entries.filter(
                  (entry) => entry.meal === meal,
                )}
                onAdd={() => setAdding(meal)}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </>
        )}
      </div>
      <AddFoodSheet
        open={adding !== null}
        meal={adding ?? 'BREAKFAST'}
        loggedOn={date}
        onClose={() => setAdding(null)}
      />
      <EditEntrySheet entry={editing} onClose={() => setEditing(null)} />
      <DeleteEntrySheet entry={deleting} onClose={() => setDeleting(null)} />
      <ClientNav active="nutrition" />
    </div>
  );
}

function DayProgress({ day }: { day: FoodDayResponse }) {
  const t = useTranslations('food');
  const locale = useLocale();
  const target = day.target ? targetAsTotals(day.target) : null;
  const calories = target ? goalState(day.totals.kcal, target.kcal) : null;

  return (
    <section className="border border-line bg-panel px-4 py-4">
      <p className="text-xs text-muted">{t('kcal')}</p>
      <p className="mt-1 flex items-end gap-2">
        <span className="font-heading text-5xl leading-none text-ink tabular-nums">
          {formatFoodAmount(day.totals.kcal, locale, 0)}
        </span>
        {target ? (
          <span className="pb-1 text-sm text-muted tabular-nums">
            / {formatFoodAmount(target.kcal, locale, 0)}
          </span>
        ) : null}
      </p>
      {calories ? (
        <Meter label={t('kcal')} progress={calories} className="mt-3 h-1.5" />
      ) : null}
      {calories ? (
        <p
          className={`mt-1 text-sm tabular-nums ${
            calories.state === 'over' ? 'text-amber' : 'text-muted'
          }`}
        >
          {calories.state === 'over'
            ? t('overBy', {
                amount: formatFoodAmount(calories.overBy, locale, 0),
              })
            : calories.state === 'met'
              ? t('goalMet')
              : t('left', {
                  amount: formatFoodAmount(
                    (target?.kcal ?? 0) - day.totals.kcal,
                    locale,
                    0,
                  ),
                })}
        </p>
      ) : (
        <TargetNote />
      )}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(['protein', 'fat', 'carbs'] as const).map((key) => {
          const progress = target
            ? goalState(day.totals[key], target[key])
            : null;
          return (
            <div key={key}>
              <p className="text-xs text-muted">{t(key)}</p>
              <p className="mt-1 text-sm text-ink tabular-nums">
                {formatFoodAmount(day.totals[key], locale, 0)}
                {target ? (
                  <span className="text-muted">
                    {' '}
                    / {formatFoodAmount(target[key], locale, 0)}
                  </span>
                ) : null}
              </p>
              {progress ? (
                <Meter
                  label={t(key)}
                  progress={progress}
                  className="mt-2 h-1"
                />
              ) : null}
              {progress?.state === 'over' ? (
                <p className="mt-1 text-xs text-amber tabular-nums">
                  {t('overBy', {
                    amount: formatFoodAmount(progress.overBy, locale, 0),
                  })}
                </p>
              ) : null}
              {progress?.state === 'met' ? (
                <p className="mt-1 text-xs text-muted">{t('goalMet')}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TargetNote() {
  const t = useTranslations('food');
  const tNutrition = useTranslations('nutrition');
  const calculations = useNutritionCalculations();
  const { mutate, isPending, error } = useCalculateNutrition();
  const queryClient = useQueryClient();
  const started = useRef(false);
  const latest = calculations.data?.calculations[0] ?? null;
  const shown = shownNutrition(latest, calculations.data?.target);
  const unsupported =
    error instanceof ApiClientError &&
    (error.code === 'INVALID_INPUT' ||
      error.code === 'NUTRITION_INPUT_UNSUPPORTED');

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
    mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['food', 'day'] });
      },
    });
  }, [
    mutate,
    calculations.isSuccess,
    calculations.isFetching,
    latest,
    queryClient,
  ]);

  if (unsupported) {
    return (
      <p className="mt-1 text-sm text-muted">{tNutrition('unsupported')}</p>
    );
  }
  if (latest?.status === 'REQUIRES_REVIEW' && !shown) {
    return (
      <p className="mt-1 text-sm text-muted">{tNutrition('pendingReview')}</p>
    );
  }
  if (isPending || calculations.isPending) {
    return <p className="mt-1 text-sm text-muted">{t('loading')}</p>;
  }
  if (calculations.isError || error) {
    return (
      <div className="mt-1">
        <p role="alert" className="text-sm text-amber">
          {tNutrition('loadError')}
        </p>
        <button
          type="button"
          onClick={() => {
            if (calculations.isError) {
              void calculations.refetch();
              return;
            }
            mutate(undefined, {
              onSuccess: () => {
                void queryClient.invalidateQueries({
                  queryKey: ['food', 'day'],
                });
              },
            });
          }}
          className="mt-2 text-sm text-teal"
        >
          {t('retry')}
        </button>
      </div>
    );
  }
  return <p className="mt-1 text-sm text-muted">{t('noTarget')}</p>;
}

function Meter({
  label,
  progress,
  className,
}: {
  label: string;
  progress: { width: number; state: 'under' | 'met' | 'over' };
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress.width)}
      className={`w-full overflow-hidden bg-line ${className ?? ''}`}
    >
      <div
        className={`h-full max-w-full ${progress.state === 'over' ? 'bg-amber' : 'bg-teal'}`}
        style={{ width: `${progress.width}%` }}
      />
    </div>
  );
}

function MealSection({
  meal,
  entries,
  onAdd,
  onEdit,
  onDelete,
}: {
  meal: FoodMeal;
  entries: FoodLogEntryResponse[];
  onAdd: () => void;
  onEdit: (entry: FoodLogEntryResponse) => void;
  onDelete: (entry: FoodLogEntryResponse) => void;
}) {
  const t = useTranslations('food');
  const locale = useLocale();
  const favorite = useToggleFavorite();
  const subtotal = useMemo(() => mealSubtotal(entries), [entries]);

  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg uppercase">
            {t(`meals.${meal}`)}
          </h2>
          <p className="text-xs text-muted tabular-nums">
            {t('mealSubtotal', {
              kcal: formatFoodAmount(subtotal.kcal, locale, 0),
            })}
            {' · '}
            {t('itemCount', { count: entries.length })}
          </p>
        </div>
        <IconButton
          label={t('addToMeal', { meal: t(`meals.${meal}`) })}
          onClick={onAdd}
        >
          <Plus size={18} />
        </IconButton>
      </div>
      {entries.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full border border-dashed border-line px-3 py-4 text-left text-sm text-muted"
        >
          {t('mealEmpty')} {t('addFood')}
        </button>
      ) : (
        <ul className="border-t border-line">
          {entries.map((entry) => {
            const label = decodeFoodText(entry.productName);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-2 border-b border-line py-3"
              >
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  aria-label={`${t('edit')} ${label}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <FoodImage src={entry.imageUrl} alt={label} />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{label}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {t('entryLine', {
                        grams: formatFoodAmount(entry.grams, locale, 1),
                        kcal: formatFoodAmount(entry.kcal, locale, 0),
                      })}
                    </span>
                    <span className="block text-xs text-muted tabular-nums">
                      {t('macroShort', {
                        protein: formatFoodAmount(entry.protein, locale, 0),
                        fat: formatFoodAmount(entry.fat, locale, 0),
                        carbs: formatFoodAmount(entry.carbs, locale, 0),
                      })}
                    </span>
                  </span>
                </button>
                {entry.productId ? (
                  <button
                    type="button"
                    aria-pressed={entry.isFavorite}
                    aria-label={
                      entry.isFavorite
                        ? t('unfavorite', { name: label })
                        : t('favorite', { name: label })
                    }
                    onClick={() => {
                      if (!entry.productId) return;
                      favorite.mutate({
                        productId: entry.productId,
                        next: !entry.isFavorite,
                      });
                    }}
                    className="grid size-11 shrink-0 place-items-center text-teal"
                  >
                    <Heart
                      size={18}
                      strokeWidth={1.6}
                      fill={entry.isFavorite ? 'currentColor' : 'none'}
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  aria-label={t('delete')}
                  className="grid size-11 shrink-0 place-items-center text-muted"
                >
                  <Trash2 size={18} strokeWidth={1.6} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DeleteEntrySheet({
  entry,
  onClose,
}: {
  entry: FoodLogEntryResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('food');
  const remove = useDeleteFoodLog();

  return (
    <Sheet
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        <SheetTitle>{t('deleteTitle')}</SheetTitle>
        <SheetDescription>
          {entry
            ? t('deleteBody', { name: decodeFoodText(entry.productName) })
            : t('deleteTitle')}
        </SheetDescription>
        <div className="flex flex-col gap-2">
          <Button
            disabled={!entry || remove.isPending}
            onClick={() => {
              if (!entry) return;
              remove.mutate(entry.id, { onSuccess: onClose });
            }}
          >
            {t('delete')}
          </Button>
          {remove.isError ? (
            <p role="alert" className="text-sm text-amber">
              {t('couldNotDelete')}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted"
          >
            {t('cancel')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 place-items-center border border-line text-ink"
    >
      {children}
    </button>
  );
}

function FoodSkeleton() {
  return (
    <div className="px-4 pt-8">
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
