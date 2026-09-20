'use client';

import { useState } from 'react';
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

export function PricingSection() {
  const t = useTranslations('marketing');
  const router = useRouter();
  const plansQuery = usePlans();
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const plans = plansQuery.data ?? [];
  const featured = plans.find((plan) => plan.intervalMonths === 3);
  const monthly = plans.find((plan) => plan.intervalMonths === 1);

  async function choosePlan(planId: string) {
    setPendingPlanId(planId);
    try {
      router.push(await resolvePlanDestination(planId));
    } finally {
      setPendingPlanId(null);
    }
  }

  return (
    <section className="border-t border-white/6 px-5 py-14">
      <p className="mb-2 font-label text-[8px] font-semibold uppercase tracking-[0.22em] text-accent">
        {t('pricing.eyebrow')}
      </p>
      <h2 className="font-heading text-[1.9rem] font-normal uppercase leading-tight tracking-tight">
        {t('pricing.heading')}
      </h2>

      <div className="mt-7 space-y-3">
        {featured ? (
          <FeaturedPlanCard
            plan={featured}
            monthly={monthly}
            pending={pendingPlanId === featured.id}
            disabled={Boolean(pendingPlanId) || plansQuery.isLoading}
            onChoose={() => void choosePlan(featured.id)}
          />
        ) : null}

        {monthly ? (
          <MonthlyPlanCard
            plan={monthly}
            pending={pendingPlanId === monthly.id}
            disabled={Boolean(pendingPlanId) || plansQuery.isLoading}
            onChoose={() => void choosePlan(monthly.id)}
          />
        ) : null}
      </div>
    </section>
  );
}

function FeaturedPlanCard({
  plan,
  monthly,
  pending,
  disabled,
  onChoose,
}: {
  plan: PlanResponse;
  monthly?: PlanResponse;
  pending: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const t = useTranslations('marketing');
  const price = formatHryvniaAmount(kopiykasToHryvnia(plan.priceAmount));
  const perMonth = formatHryvniaAmount(monthlyHryvnia(plan));
  const saved =
    monthly && savingsHryvnia(plan, monthly) > 0
      ? formatHryvniaAmount(savingsHryvnia(plan, monthly))
      : null;

  return (
    <article className="relative overflow-hidden border border-[#c8ff2e]/35 bg-[#c8ff2e]/3">
      <div className="h-0.5 bg-linear-to-r from-[#c8ff2e] to-transparent" />
      <div className="p-5">
        <span className="absolute top-3.5 right-4 bg-[#c8ff2e] px-2.5 py-0.5 font-label text-[8px] font-bold tracking-[0.12em] text-[#0b0b0b]">
          {t('pricing.featuredBadge')}
        </span>
        <p className="mb-2.5 font-label text-[8px] font-bold tracking-[0.2em] text-white/40">
          {t('pricing.threeMonthsLabel')}
        </p>
        <p className="font-heading text-5xl font-normal tracking-tight">
          {price} <span className="text-2xl text-white/50">₴</span>
        </p>
        <div className="mt-1.5 flex gap-4 text-xs">
          <span className="text-white/45">
            {t('pricing.perMonth', { amount: perMonth })}
          </span>
          {saved ? (
            <span className="font-semibold text-[#c8ff2e]">
              {t('pricing.savings', { amount: saved })}
            </span>
          ) : null}
        </div>
        <Button
          className="mt-5 w-full bg-[#c8ff2e] text-[#0b0b0b] shadow-none"
          disabled={disabled}
          onClick={onChoose}
        >
          {pending ? t('pricing.choosing') : t('pricing.chooseThreeMonths')}
        </Button>
      </div>
    </article>
  );
}

function MonthlyPlanCard({
  plan,
  pending,
  disabled,
  onChoose,
}: {
  plan: PlanResponse;
  pending: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const t = useTranslations('marketing');
  const price = formatHryvniaAmount(kopiykasToHryvnia(plan.priceAmount));

  return (
    <article className="border border-white/10 bg-white/2 p-5">
      <p className="mb-2.5 font-label text-[8px] font-bold tracking-[0.2em] text-white/35">
        {t('pricing.oneMonthLabel')}
      </p>
      <p className="font-heading text-4xl font-normal tracking-tight">
        {price} <span className="text-xl text-white/40">₴</span>
      </p>
      <p className="mt-1.5 text-xs text-white/35">
        {t('pricing.oneMonthAccess')}
      </p>
      <Button
        variant="outline"
        className="mt-5 w-full"
        disabled={disabled}
        onClick={onChoose}
      >
        {pending ? t('pricing.choosing') : t('pricing.chooseOneMonth')}
      </Button>
    </article>
  );
}
