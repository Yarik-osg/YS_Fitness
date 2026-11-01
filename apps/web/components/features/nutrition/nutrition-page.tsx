'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';
import { ClientNav } from '@/components/features/shell/client-nav';
import { LockedProgramScreen } from '@/components/features/subscription/locked-screen';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError } from '@/lib/api/client';
import { getUserFacingError } from '@/lib/api/errors';
import {
  useCalculateNutrition,
  useNutritionCalculations,
} from '@/lib/hooks/use-nutrition';
import { roundHalfAwayFromZero, shownNutrition } from '@/lib/nutrition-display';

export function NutritionPage() {
  const t = useTranslations('nutrition');
  const tAuth = useTranslations('auth');
  const calculations = useNutritionCalculations();
  const calculate = useCalculateNutrition();
  const { mutate } = calculate;
  const started = useRef(false);
  const latest = calculations.data?.calculations[0] ?? null;
  const shown = shownNutrition(latest, calculations.data?.target);
  const needsPlan = isSubscriptionRequired(calculations.error);
  const unsupported =
    calculate.error instanceof ApiClientError &&
    calculate.error.code === 'NUTRITION_INPUT_UNSUPPORTED';

  useEffect(() => {
    if (
      started.current ||
      needsPlan ||
      !calculations.isSuccess ||
      calculations.isFetching ||
      latest
    ) {
      return;
    }
    started.current = true;
    mutate();
  }, [
    mutate,
    calculations.isSuccess,
    calculations.isFetching,
    latest,
    needsPlan,
  ]);

  if (calculations.isPending && calculations.data === undefined) {
    return <NutritionLoading label={t('loading')} />;
  }

  if (needsPlan) {
    return (
      <LockedProgramScreen nav="nutrition">
        <NutritionSkeleton />
      </LockedProgramScreen>
    );
  }

  if (calculations.isError) {
    return (
      <NutritionFrame>
        <p className="text-sm text-muted">{t('loadError')}</p>
      </NutritionFrame>
    );
  }

  if (!shown && !calculate.isError) {
    return <NutritionLoading label={t('loading')} />;
  }

  return (
    <NutritionFrame>
      {unsupported && !shown ? (
        <p role="alert" className="text-sm leading-6 text-white/35">
          {t('unsupported')}
        </p>
      ) : null}
      {calculate.isError && !unsupported && !shown ? (
        <p role="alert" className="text-sm leading-6 text-white/35">
          {getUserFacingError(calculate.error, tAuth)}
        </p>
      ) : null}
      {shown ? (
        <DailyTargets
          calculation={shown}
          carbsNonPositive={
            calculations.data?.target?.source !== 'MANUAL' &&
            Boolean(latest?.carbsNonPositive)
          }
        />
      ) : null}
      <MenuSoon />
    </NutritionFrame>
  );
}

function DailyTargets({
  calculation,
  carbsNonPositive,
}: {
  calculation: {
    targetCalories: string;
    proteinGrams: string;
    fatGrams: string;
    carbsGrams: string;
  };
  carbsNonPositive: boolean;
}) {
  const t = useTranslations('nutrition');
  const kcal = roundHalfAwayFromZero(calculation.targetCalories);
  const macros = [
    {
      label: t('protein'),
      value: roundHalfAwayFromZero(calculation.proteinGrams),
      color: 'text-teal',
    },
    {
      label: t('fat'),
      value: roundHalfAwayFromZero(calculation.fatGrams),
      color: 'text-lime',
    },
    {
      label: t('carbs'),
      value: roundHalfAwayFromZero(calculation.carbsGrams),
      color: 'text-white/65',
    },
  ] as const;

  return (
    <>
      <section className="overflow-hidden border-[1.5px] border-teal/15 bg-teal/[0.03]">
        <div className="h-0.5 bg-linear-to-r from-teal to-transparent" />
        <div className="px-5 pt-5">
          <div className="mb-5 flex items-end gap-2">
            <p className="font-heading text-[64px] leading-none tracking-[-0.03em] text-teal tabular-nums">
              {kcal}
            </p>
            <div className="flex flex-col gap-0.5 pb-2.5">
              <p className="font-label text-[10px] font-bold tracking-[0.14em] text-white/50 uppercase">
                {t('kcal')}
              </p>
              <p className="text-[10px] font-medium text-white/30">
                {t('perDay')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-t border-white/5">
          {macros.map((macro, index) => (
            <div
              key={macro.label}
              className={`flex flex-1 flex-col items-center bg-white/[0.02] px-2 py-4 ${
                index < macros.length - 1 ? 'border-r border-white/5' : ''
              }`}
            >
              <p className="mb-1.5 flex items-baseline gap-0.5">
                <span
                  className={`font-heading text-[28px] leading-none tracking-[-0.01em] tabular-nums ${macro.color}`}
                >
                  {macro.value}
                </span>
                <span className="text-[10px] font-semibold text-white/30">
                  {t('grams')}
                </span>
              </p>
              <p className="font-label text-[7px] font-bold tracking-[0.14em] text-white/30 uppercase">
                {macro.label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <p className="px-0.5 text-[11px] leading-relaxed font-medium text-white/35">
        {t('note')}
      </p>
      {carbsNonPositive ? (
        <p className="px-0.5 text-[11px] leading-relaxed font-medium text-amber">
          {t('carbsNonPositive')}
        </p>
      ) : null}
    </>
  );
}

function MenuSoon() {
  const t = useTranslations('nutrition');

  return (
    <section className="border-[1.5px] border-line bg-panel px-5 pt-5 pb-6">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-heading text-[22px] leading-tight tracking-[0.04em] text-white/40 uppercase">
          <Lock
            size={15}
            strokeWidth={1.6}
            aria-hidden="true"
            className="shrink-0 text-muted"
          />
          {t('menuTitle')}
        </h2>
        <span className="flex shrink-0 items-center gap-1.5 border border-amber/25 bg-amber/10 px-2.5 py-1 font-label text-[8px] font-bold tracking-[0.16em] text-amber uppercase">
          <span className="size-[5px] rounded-full bg-amber" />
          {t('inProgress')}
        </span>
      </div>
      <p className="text-xs leading-relaxed font-medium text-white/30">
        {t('menuBody')}
      </p>
    </section>
  );
}

function NutritionFrame({ children }: { children: ReactNode }) {
  const t = useTranslations('nutrition');

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background pb-24 text-ink">
      <header className="border-b border-line px-5 pt-8 pb-4">
        <p className="mb-1.5 font-label text-[8px] font-semibold tracking-[0.2em] text-teal uppercase">
          {t('brand')}
        </p>
        <h1 className="font-heading text-[28px] leading-none text-ink uppercase">
          {t('title')}
        </h1>
      </header>
      <div className="flex flex-col gap-5 px-4 pt-5">{children}</div>
      <ClientNav active="nutrition" />
    </div>
  );
}

function NutritionLoading({ label }: { label: string }) {
  return (
    <main
      aria-busy="true"
      aria-label={label}
      className="mx-auto min-h-screen w-full max-w-[430px] bg-background px-4 pt-8 pb-24"
    >
      <NutritionSkeleton />
      <ClientNav active="nutrition" />
    </main>
  );
}

function NutritionSkeleton() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-2 w-20" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-64 w-full" />
    </>
  );
}

function isSubscriptionRequired(error: unknown) {
  return (
    error instanceof ApiClientError && error.code === 'SUBSCRIPTION_REQUIRED'
  );
}
