'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PlanResponse } from '@repo/shared-types';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { usePlans } from '@/lib/hooks/use-subscriptions';
import {
  formatHryvniaAmount,
  kopiykasToHryvnia,
  monthlyHryvnia,
  savingsHryvnia,
} from '@/lib/subscriptions/money';
import { resolvePlanDestination } from '@/lib/subscriptions/resolve-plan-destination';
import { cn } from '@/lib/utils';

const PLAN_ORDER = ['1_MONTH', '3_MONTHS', 'FULL_ACCESS'] as const;

type CatalogCode = (typeof PLAN_ORDER)[number];

function catalogCode(code: string): CatalogCode | null {
  return PLAN_ORDER.includes(code as CatalogCode)
    ? (code as CatalogCode)
    : null;
}

function planCopy(
  t: ReturnType<typeof useTranslations<'marketing'>>,
  kind: CatalogCode,
) {
  switch (kind) {
    case '1_MONTH':
      return {
        name: t('pricing.plans.1_MONTH.name'),
        period: t('pricing.plans.1_MONTH.period'),
        description: t('pricing.plans.1_MONTH.description'),
        choose: t('pricing.plans.1_MONTH.choose'),
        features: t.raw('pricing.plans.1_MONTH.features') as string[],
      };
    case '3_MONTHS':
      return {
        name: t('pricing.plans.3_MONTHS.name'),
        period: t('pricing.plans.3_MONTHS.period'),
        description: t('pricing.plans.3_MONTHS.description'),
        choose: t('pricing.plans.3_MONTHS.choose'),
        features: t.raw('pricing.plans.3_MONTHS.features') as string[],
      };
    case 'FULL_ACCESS':
      return {
        name: t('pricing.plans.FULL_ACCESS.name'),
        period: t('pricing.plans.FULL_ACCESS.period'),
        description: t('pricing.plans.FULL_ACCESS.description'),
        choose: t('pricing.plans.FULL_ACCESS.choose'),
        features: t.raw('pricing.plans.FULL_ACCESS.features') as string[],
      };
  }
}

export function PricingSection() {
  const t = useTranslations('marketing');
  const router = useRouter();
  const plansQuery = usePlans();
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const plans = [...(plansQuery.data ?? [])].sort((left, right) => {
    const leftRank = PLAN_ORDER.indexOf(left.code as CatalogCode);
    const rightRank = PLAN_ORDER.indexOf(right.code as CatalogCode);
    return (
      (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank)
    );
  });
  const monthly = plans.find((plan) => plan.code === '1_MONTH');

  async function choosePlan(planId: string) {
    setPendingPlanId(planId);
    try {
      router.push(await resolvePlanDestination(planId));
    } finally {
      setPendingPlanId(null);
    }
  }

  return (
    <section className="border-t border-white/6 px-5 py-[52px]">
      <p className="mb-2.5 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
        {t('pricing.eyebrow')}
      </p>
      <h2 className="font-heading text-[30px] font-normal uppercase leading-[1.1] tracking-[-0.02em]">
        {t('pricing.heading')}
      </h2>

      <div className="mt-7 space-y-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            monthly={monthly}
            pending={pendingPlanId === plan.id}
            disabled={Boolean(pendingPlanId) || plansQuery.isLoading}
            expanded={expandedPlanId === plan.id}
            onToggleIncludes={() =>
              setExpandedPlanId((current) =>
                current === plan.id ? null : plan.id,
              )
            }
            onChoose={() => void choosePlan(plan.id)}
          />
        ))}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  monthly,
  pending,
  disabled,
  expanded,
  onToggleIncludes,
  onChoose,
}: {
  plan: PlanResponse;
  monthly?: PlanResponse;
  pending: boolean;
  disabled: boolean;
  expanded: boolean;
  onToggleIncludes: () => void;
  onChoose: () => void;
}) {
  const t = useTranslations('marketing');
  const kind = catalogCode(plan.code) ?? '1_MONTH';
  const copy = planCopy(t, kind);
  const isProgress = kind === '3_MONTHS';
  const isFull = kind === 'FULL_ACCESS';
  const price = formatHryvniaAmount(kopiykasToHryvnia(plan.priceAmount));
  const perMonth = formatHryvniaAmount(monthlyHryvnia(plan));
  const saved =
    isProgress && monthly && savingsHryvnia(plan, monthly) > 0
      ? formatHryvniaAmount(savingsHryvnia(plan, monthly))
      : null;

  return (
    <article
      className={cn(
        'relative overflow-hidden border',
        isProgress && 'border-[#c8ff2e]/27 bg-[#c8ff2e]/[0.025]',
        isFull && 'border-accent/30 bg-accent/[0.02]',
        !isProgress && !isFull && 'border-white/9 bg-white/[0.01]',
      )}
    >
      {isProgress ? (
        <div className="h-0.5 bg-linear-to-r from-[#c8ff2e] to-transparent" />
      ) : null}
      {isFull ? (
        <div className="h-0.5 bg-linear-to-r from-accent/80 to-transparent" />
      ) : null}
      <div className="px-5 pt-[18px]">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                'font-label text-[9px] font-bold tracking-[0.2em]',
                isProgress && 'text-[#c8ff2e]',
                isFull && 'text-accent',
                !isProgress && !isFull && 'text-white/55',
              )}
            >
              {copy.name}
            </span>
            <span className="inline-block h-2.5 w-px bg-white/15" />
            <span className="text-[10px] uppercase text-white/35">
              {copy.period}
            </span>
            {isProgress ? (
              <>
                <span className="inline-block h-2.5 w-px bg-white/15" />
                <span className="text-[10px] font-semibold text-[#c8ff2e]">
                  {t('pricing.perMonth', { amount: perMonth })}
                </span>
              </>
            ) : null}
          </div>
          {isProgress ? (
            <span className="shrink-0 bg-[#c8ff2e] px-2.5 py-0.5 font-label text-[7px] font-bold tracking-[0.12em] text-[#0b0b0b] uppercase">
              {t('pricing.featuredBadge')}
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            'flex items-baseline gap-1 font-heading font-normal leading-none tracking-tight',
            isProgress ? 'text-[44px]' : 'text-[34px]',
          )}
        >
          {price}
          <span className="text-[20px] text-white/40">₴</span>
          {saved ? (
            <span className="ml-2 border border-[#c8ff2e]/30 bg-[#c8ff2e]/15 px-2 py-0.5 font-label text-[7.5px] font-bold tracking-[0.1em] text-[#c8ff2e]">
              {t('pricing.savings', { amount: saved })}
            </span>
          ) : null}
        </p>
        <p className="mt-2.5 text-xs leading-[1.55] text-white/45">
          {copy.description}
        </p>
        <div className="mt-4 mb-[18px] flex gap-2">
          <Button
            variant={isProgress ? 'primary' : 'outline'}
            className={cn(
              'h-auto min-h-0 flex-1 px-2.5 py-3 text-[10px] tracking-[0.13em]',
              isProgress &&
                'border-[#c8ff2e] bg-[#c8ff2e] text-[#0b0b0b] shadow-none',
              isFull && 'border-accent text-accent',
              !isProgress && !isFull && 'border-white/55 text-white/55',
            )}
            disabled={disabled}
            onClick={onChoose}
          >
            {pending ? t('pricing.choosing') : copy.choose}
          </Button>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggleIncludes}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap border border-white/10 px-3.5 py-3 font-label text-[9px] font-semibold tracking-[0.1em] text-white/40 uppercase"
          >
            {expanded ? t('pricing.collapse') : t('pricing.includes')}
            <ChevronDown
              size={10}
              strokeWidth={1.8}
              className={cn('transition-transform', expanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>
      {expanded ? (
        <ul className="flex flex-col gap-[11px] border-t border-white/6 px-5 pt-4 pb-5">
          {copy.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-xs leading-[1.5] text-white/[0.72]"
            >
              <Check
                size={14}
                strokeWidth={2.2}
                className={cn(
                  'mt-px shrink-0',
                  isProgress && 'text-[#c8ff2e]',
                  isFull && 'text-accent',
                  !isProgress && !isFull && 'text-white/50',
                )}
              />
              {feature}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
