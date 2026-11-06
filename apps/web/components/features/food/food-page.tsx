'use client';

import type {
  FoodDayResponse,
  FoodLogEntryResponse,
  FoodMeal,
} from '@repo/shared-types';
import { FOOD_MEALS, isCalendarDate } from '@repo/validation';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AddFoodSheet } from '@/components/features/food/add-food-sheet';
import { EditEntrySheet } from '@/components/features/food/edit-entry-sheet';
import { FoodImage } from '@/components/features/food/food-image';
import { ClientNav } from '@/components/features/shell/client-nav';
import { LockedProgramScreen } from '@/components/features/subscription/locked-screen';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { localDateKey } from '@/lib/calendar';
import {
  formatFoodDate,
  selectedFoodDate,
  shiftFoodDate,
} from '@/lib/food/dates';
import {
  FOOD_MACRO_KEYS,
  mealSubtotal,
  remainingTone,
  targetAsTotals,
} from '@/lib/food/macros';
import { useDeleteFoodLog, useFoodDay } from '@/lib/hooks/use-food';

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
    router.replace(`/food?date=${next}`);
  }

  if (
    day.error instanceof ApiClientError &&
    day.error.code === 'SUBSCRIPTION_REQUIRED'
  ) {
    return (
      <LockedProgramScreen nav="food">
        <FoodSkeleton />
      </LockedProgramScreen>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-24 text-ink">
      <header className="border-b border-line px-5 pt-8 pb-4">
        <p className="mb-1.5 font-label text-[8px] font-semibold tracking-[0.2em] text-teal uppercase">
          {t('brand')}
        </p>
        <h1 className="font-heading text-[28px] leading-none text-ink uppercase">
          {t('title')}
        </h1>
        <div className="mt-4 flex items-center gap-2">
          <IconButton
            label={t('previousDay')}
            onClick={() => setDate(shiftFoodDate(date, -1))}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <input
            type="date"
            aria-label={t('date')}
            value={date}
            onChange={(event) => {
              if (isCalendarDate(event.target.value))
                setDate(event.target.value);
            }}
            className="min-w-0 flex-1 border border-line bg-panel px-2 py-2 text-sm text-ink"
          />
          <IconButton
            label={t('nextDay')}
            onClick={() => setDate(shiftFoodDate(date, 1))}
          >
            <ChevronRight size={18} />
          </IconButton>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="px-2 text-sm text-teal"
          >
            {t('today')}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          {formatFoodDate(date, locale)}
        </p>
      </header>
      <div className="flex flex-col gap-5 px-4 pt-5">
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
      <ClientNav active="food" />
    </div>
  );
}

function DayProgress({ day }: { day: FoodDayResponse }) {
  const t = useTranslations('food');
  const locale = useLocale();
  const target = day.target ? targetAsTotals(day.target) : null;

  return (
    <section className="border border-line bg-panel p-4">
      <h2 className="mb-3 font-heading text-lg uppercase">{t('eaten')}</h2>
      <div className="flex flex-col gap-3">
        {FOOD_MACRO_KEYS.map((key) => (
          <MacroRow
            key={key}
            label={t(key)}
            eaten={day.totals[key]}
            target={target ? target[key] : null}
            remaining={day.remaining ? day.remaining[key] : null}
            locale={locale}
          />
        ))}
      </div>
      {target ? null : (
        <p className="mt-3 text-sm text-muted">
          {t('noTarget')}{' '}
          <Link href="/nutrition" className="text-teal">
            {t('openNutrition')}
          </Link>
        </p>
      )}
    </section>
  );
}

function MacroRow({
  label,
  eaten,
  target,
  remaining,
  locale,
}: {
  label: string;
  eaten: number;
  target: number | null;
  remaining: number | null;
  locale: string;
}) {
  const t = useTranslations('food');
  const tone = remaining === null ? null : remainingTone(remaining);
  const ratio = target && target > 0 ? (eaten / target) * 100 : 0;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-ink">
          {target !== null
            ? `${formatAmount(eaten, locale)} / ${formatAmount(target, locale)}`
            : formatAmount(eaten, locale)}
        </span>
      </div>
      {target !== null ? <Progress value={ratio} label={label} /> : null}
      {tone ? (
        <p
          className={`mt-1 text-xs tabular-nums ${
            tone.tone === 'over' ? 'text-amber' : 'text-muted'
          }`}
        >
          {tone.tone === 'over'
            ? t('overBy', { amount: formatAmount(tone.amount, locale) })
            : t('left', { amount: formatAmount(tone.amount, locale) })}
        </p>
      ) : null}
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
  const subtotal = useMemo(() => mealSubtotal(entries), [entries]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg uppercase">{t(`meals.${meal}`)}</h2>
        <IconButton
          label={t('addToMeal', { meal: t(`meals.${meal}`) })}
          onClick={onAdd}
        >
          <Plus size={18} />
        </IconButton>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">{t('mealEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="border border-line bg-panel p-3">
              <div className="flex gap-3">
                <FoodImage src={entry.imageUrl} alt={entry.productName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {entry.productName}
                  </p>
                  <p className="text-xs text-muted tabular-nums">
                    {t('entryLine', {
                      grams: formatAmount(entry.grams, locale),
                      kcal: formatAmount(entry.kcal, locale),
                    })}
                  </p>
                  <p className="text-xs text-muted tabular-nums">
                    {t('macroLine', {
                      protein: formatAmount(entry.protein, locale),
                      fat: formatAmount(entry.fat, locale),
                      carbs: formatAmount(entry.carbs, locale),
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="text-sm text-teal"
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  className="text-sm text-muted"
                >
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 ? (
        <p className="mt-2 text-xs text-muted tabular-nums">
          {t('mealSubtotal', {
            kcal: formatAmount(subtotal.kcal, locale),
          })}
        </p>
      ) : null}
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
            ? t('deleteBody', { name: entry.productName })
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

function formatAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value,
  );
}
