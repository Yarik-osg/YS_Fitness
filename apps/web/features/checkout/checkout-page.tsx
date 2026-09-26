'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import type { PlanResponse, SubscriptionResponse } from '@repo/shared-types';
import { Check } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getUserFacingError } from '@/lib/api/errors';
import { getMySubscription } from '@/lib/api/subscriptions';
import { useCheckout, usePlans } from '@/lib/hooks/use-subscriptions';
import {
  formatHryvniaAmount,
  kopiykasToHryvnia,
  monthlyHryvnia,
} from '@/lib/subscriptions/money';
import {
  clearSelectedPlanId,
  persistSelectedPlanId,
  readProgramTrack,
  readSelectedPlanId,
} from '@/lib/subscriptions/selected-plan';
import { cn } from '@/lib/utils';

const PLAN_ORDER = ['1_MONTH', '3_MONTHS', 'FULL_ACCESS'] as const;

type CatalogCode = (typeof PLAN_ORDER)[number];
type CheckoutStep = 'select' | 'pay';

function catalogCode(code: string): CatalogCode | null {
  return PLAN_ORDER.includes(code as CatalogCode)
    ? (code as CatalogCode)
    : null;
}

export function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFrame>{null}</CheckoutFrame>}>
      <CheckoutFlow />
    </Suspense>
  );
}

function CheckoutFlow() {
  const searchParams = useSearchParams();
  const plansQuery = usePlans();
  const checkout = useCheckout();
  const t = useTranslations('checkout');
  const tAuth = useTranslations('auth');
  const tPricing = useTranslations('marketing');
  const [step, setStep] = useState<CheckoutStep>('select');
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('planId') ?? readSelectedPlanId(),
  );
  const [agreed, setAgreed] = useState(false);
  const [cardAdded, setCardAdded] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const plans = useMemo(() => {
    return [...(plansQuery.data ?? [])].sort((left, right) => {
      const leftRank = PLAN_ORDER.indexOf(left.code as CatalogCode);
      const rightRank = PLAN_ORDER.indexOf(right.code as CatalogCode);
      return (
        (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank)
      );
    });
  }, [plansQuery.data]);

  const selected =
    plans.find((plan) => plan.id === selectedId) ??
    plans.find((plan) => plan.code === '3_MONTHS') ??
    plans[0];

  useEffect(() => {
    let active = true;
    void getMySubscription()
      .then((existing) => {
        if (
          active &&
          existing &&
          (existing.status === 'ACTIVE' || existing.status === 'PENDING')
        ) {
          setSubscription(existing);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function pay() {
    if (!selected || !agreed || !cardAdded) return;
    setError(null);
    persistSelectedPlanId(selected.id);
    try {
      const result = await checkout.mutateAsync(selected.id);
      clearSelectedPlanId();
      setSubscription(result.subscription);
    } catch (cause) {
      setError(getUserFacingError(cause, tAuth) || t('error'));
    }
  }

  if (subscription) {
    return <CheckoutSuccess />;
  }

  if (plansQuery.isPending || plansQuery.isLoading) {
    return (
      <CheckoutFrame>
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
          {t('loadingPlans')}
        </p>
      </CheckoutFrame>
    );
  }

  if (plansQuery.isError) {
    return (
      <CheckoutFrame>
        <p className="text-sm text-muted">{t('error')}</p>
        <Button
          className="mt-8 w-full"
          onClick={() => void plansQuery.refetch()}
        >
          {t('retry')}
        </Button>
      </CheckoutFrame>
    );
  }

  if (!selected) {
    return (
      <CheckoutFrame>
        <p className="text-sm text-muted">{t('missingPlan')}</p>
        <Button
          className="mt-8 w-full"
          onClick={() => void plansQuery.refetch()}
        >
          {t('retry')}
        </Button>
      </CheckoutFrame>
    );
  }

  const kind = catalogCode(selected.code) ?? '3_MONTHS';
  const selectedCopy = planCopy(tPricing, kind);

  if (step === 'pay') {
    return (
      <CheckoutFrame
        eyebrow={t('payEyebrow')}
        title={t.rich('payTitle', {
          accent: (chunks) => <span className="text-accent">{chunks}</span>,
        })}
        onBack={() => {
          setError(null);
          setStep('select');
        }}
      >
        <PaymentStep
          selected={selected}
          selectedCopy={selectedCopy}
          agreed={agreed}
          cardAdded={cardAdded}
          pending={checkout.isPending}
          error={error}
          onToggleAgreed={() => setAgreed((current) => !current)}
          onAddCard={() => setCardAdded(true)}
          onPay={() => void pay()}
        />
      </CheckoutFrame>
    );
  }

  return (
    <CheckoutFrame
      eyebrow={t('selectEyebrow')}
      title={t.rich('selectTitle', {
        accent: (chunks) => <span className="text-accent">{chunks}</span>,
      })}
    >
      <PlanSelectStep
        plans={plans}
        selectedId={selected.id}
        onSelect={(planId) => {
          setSelectedId(planId);
          persistSelectedPlanId(planId);
        }}
        onContinue={() => {
          persistSelectedPlanId(selected.id);
          setStep('pay');
        }}
      />
    </CheckoutFrame>
  );
}

function PlanSelectStep({
  plans,
  selectedId,
  onSelect,
  onContinue,
}: {
  plans: PlanResponse[];
  selectedId: string;
  onSelect: (planId: string) => void;
  onContinue: () => void;
}) {
  const t = useTranslations('checkout');
  const tPricing = useTranslations('marketing');
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  const selectedKind = catalogCode(selected?.code ?? '') ?? '3_MONTHS';
  const selectedCopy = planCopy(tPricing, selectedKind);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {plans.map((plan) => {
          const kind = catalogCode(plan.code) ?? '1_MONTH';
          const copy = planCopy(tPricing, kind);
          const active = plan.id === selectedId;
          const isProgress = kind === '3_MONTHS';
          const isFull = kind === 'FULL_ACCESS';
          const accent = isProgress
            ? 'text-[#c8ff2e]'
            : isFull
              ? 'text-accent'
              : 'text-white/50';

          return (
            <button
              key={plan.id}
              type="button"
              aria-pressed={active}
              aria-label={copy.name}
              onClick={() => onSelect(plan.id)}
              className={cn(
                'w-full overflow-hidden border text-left transition',
                active && isProgress && 'border-[#c8ff2e]/33 bg-[#c8ff2e]/4',
                active && isFull && 'border-accent/25 bg-accent/3',
                active &&
                  !isProgress &&
                  !isFull &&
                  'border-white/20 bg-white/2',
                !active && 'border-white/9 bg-white/1',
              )}
            >
              {active && isProgress ? (
                <div className="h-0.5 bg-linear-to-r from-[#c8ff2e] to-transparent" />
              ) : null}
              {active && isFull ? (
                <div className="h-0.5 bg-linear-to-r from-accent/80 to-transparent" />
              ) : null}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded-full border',
                    active && isProgress && 'border-[#c8ff2e]',
                    active && isFull && 'border-accent',
                    active && !isProgress && !isFull && 'border-white/50',
                    !active && 'border-white/20',
                  )}
                >
                  {active ? (
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        isProgress && 'bg-[#c8ff2e]',
                        isFull && 'bg-accent',
                        !isProgress && !isFull && 'bg-white/50',
                      )}
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'font-label text-[10px] font-bold tracking-[0.14em]',
                        active ? accent : 'text-white/50',
                      )}
                    >
                      {copy.name}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {copy.period}
                    </span>
                    {isProgress ? (
                      <span className="text-[10px] font-semibold text-[#c8ff2e]">
                        {tPricing('pricing.perMonth', {
                          amount: formatHryvniaAmount(monthlyHryvnia(plan)),
                        })}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] leading-[1.45] text-white/35">
                    {copy.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p>
                    <span
                      className={cn(
                        'font-heading text-[22px] tracking-tight',
                        active ? 'text-white' : 'text-white/45',
                      )}
                    >
                      {formatHryvniaAmount(kopiykasToHryvnia(plan.priceAmount))}
                    </span>
                    <span className="ml-0.5 text-[10px] text-white/30">₴</span>
                  </p>
                  {isProgress ? (
                    <span className="mt-1 inline-block bg-[#c8ff2e] px-1.5 py-0.5 font-label text-[6.5px] font-bold tracking-[0.1em] text-[#0b0b0b] uppercase">
                      {tPricing('pricing.featuredBadge')}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-6 border border-white/10 bg-white/2 px-[18px] py-4">
          <p className="mb-3 font-label text-[7.5px] font-semibold tracking-[0.16em] text-white/30 uppercase">
            {t('selectedPlan')}
          </p>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-label text-sm font-bold tracking-[0.1em] text-accent">
                {selectedCopy.name}
              </p>
              <p className="text-[11px] text-white/40">{selectedCopy.period}</p>
            </div>
            <p>
              <span className="font-heading text-[28px]">
                {formatHryvniaAmount(kopiykasToHryvnia(selected.priceAmount))}
              </span>
              <span className="ml-1 text-xs text-white/40">₴</span>
            </p>
          </div>
          <ul className="flex flex-col gap-1.5 border-t border-white/6 pt-3">
            {selectedCopy.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check size={12} strokeWidth={2.2} className="text-accent" />
                <span className="text-[11px] text-white/60">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button className="mt-6 w-full" onClick={onContinue}>
        {t('goToPayment')}
      </Button>
    </>
  );
}

function PaymentStep({
  selected,
  selectedCopy,
  agreed,
  cardAdded,
  pending,
  error,
  onToggleAgreed,
  onAddCard,
  onPay,
}: {
  selected: PlanResponse;
  selectedCopy: PlanCopy;
  agreed: boolean;
  cardAdded: boolean;
  pending: boolean;
  error: string | null;
  onToggleAgreed: () => void;
  onAddCard: () => void;
  onPay: () => void;
}) {
  const t = useTranslations('checkout');
  const programName = t('programFallback');

  return (
    <>
      <div className="relative border border-white/12 bg-white/2 px-[18px] py-[18px]">
        <div className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
        <p className="mb-2.5 font-label text-[8px] font-semibold tracking-[0.16em] text-white/35 uppercase">
          {t('order')}
        </p>
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <p className="font-label text-[15px] font-bold tracking-[0.06em] text-accent">
              {programName}
            </p>
            <p className="text-[11px] text-white/40">
              {selectedCopy.name} · {selectedCopy.period}
            </p>
          </div>
          <p className="text-right">
            <span className="font-heading text-[26px]">
              {formatHryvniaAmount(kopiykasToHryvnia(selected.priceAmount))}
            </span>{' '}
            <span className="text-[11px] text-white/40">₴</span>
          </p>
        </div>
        <div className="mb-3.5 h-px bg-white/7" />
        {[
          [t('accessDuration'), selectedCopy.period],
          [t('cabinet'), t('cabinetValue')],
          [t('nutritionPlan'), t('included')],
        ].map(([label, value]) => (
          <div key={label} className="mb-2 flex justify-between gap-3">
            <span className="text-xs text-white/40">{label}</span>
            <span className="text-xs font-semibold text-white/75">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2.5 font-label text-[9px] font-semibold tracking-[0.16em] text-white/35 uppercase">
          {t('paymentMethod')}
        </p>
        <button
          type="button"
          onClick={onAddCard}
          className="flex w-full items-center gap-3 border border-white/10 bg-white/2 px-4 py-3.5 text-left"
        >
          <span className="grid h-4 w-[22px] place-items-center rounded-[2px] border border-white/20">
            <span className="h-1 w-full bg-white/10" />
          </span>
          <span className="text-[13px] tracking-[0.1em] text-white/35">
            {cardAdded ? t('cardAdded') : t('cardMasked')}
          </span>
          <span className="ml-auto font-label text-[9px] tracking-[0.08em] text-white/25 uppercase">
            {cardAdded ? t('cardReady') : t('addCard')}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleAgreed}
        className="mt-5 flex items-start gap-2.5 text-left"
      >
        <span
          className={cn(
            'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] border',
            agreed ? 'border-accent bg-accent' : 'border-white/20',
          )}
        >
          {agreed ? (
            <Check size={9} strokeWidth={3} className="text-[#0b0b0b]" />
          ) : null}
        </span>
        <span className="text-[11px] leading-5 text-white/40">
          {t('agreement')}
        </span>
      </button>

      <div className="mt-5 flex gap-4 text-[10px] text-white/30">
        <span>{t('secure')}</span>
        <span>{t('ssl')}</span>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 border-l-2 border-red-400 bg-red-400/8 px-4 py-3 text-xs text-red-300"
        >
          {error}
        </p>
      ) : null}

      <Button
        className="mt-6 w-full"
        disabled={!agreed || !cardAdded || pending}
        onClick={onPay}
      >
        {pending
          ? t('paying')
          : t('pay', {
              amount: formatHryvniaAmount(
                kopiykasToHryvnia(selected.priceAmount),
              ),
            })}
      </Button>
    </>
  );
}

function CheckoutSuccess() {
  const t = useTranslations('checkout');

  return (
    <CheckoutFrame hideIntro>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 grid size-28 place-items-center rounded-full border-2 border-accent bg-accent/8 shadow-[0_0_56px_color-mix(in_srgb,var(--accent)_28%,transparent)]">
          <Check size={44} strokeWidth={2.2} className="text-accent" />
        </div>
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00c7c8]">
          {t('eyebrow')}
        </p>
        <h1 className="mt-4 font-heading text-[34px] font-normal uppercase leading-10 tracking-[-0.02em]">
          {t.rich('successTitle', {
            accent: (chunks) => <span className="text-accent">{chunks}</span>,
          })}
        </h1>
        <div className="mx-auto my-5 h-px w-15 bg-accent" />
        <p className="max-w-[18rem] text-[13px] leading-[1.65] text-white/60">
          {t('successBody')}
        </p>
        <div className="mt-10 grid w-full grid-cols-3 gap-3 border-t border-white/8 pt-6">
          <SuccessStat
            value={t('successStatWeeks')}
            label={t('successStatWeeksLabel')}
          />
          <SuccessStat
            value={t('successStatAccess')}
            label={t('successStatAccessLabel')}
          />
          <SuccessStat
            value={t('successStatReady')}
            label={t('successStatReadyLabel')}
          />
        </div>
        <Link href="/dashboard" className="mt-12 inline-block w-full">
          <Button className="w-full">{t('dashboardCta')}</Button>
        </Link>
        <p className="mt-8 font-label text-[8px] font-medium tracking-[0.12em] text-white/35">
          TRAIN.&nbsp;&nbsp;DISCIPLINE.&nbsp;&nbsp;
          <span className="text-[#c8ff2e]">EVOLVE</span>
        </p>
      </div>
    </CheckoutFrame>
  );
}

function SuccessStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-heading text-[26px] leading-none tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 font-label text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
    </div>
  );
}

function CheckoutFrame({
  children,
  eyebrow,
  title,
  onBack,
  hideIntro = false,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title?: React.ReactNode;
  onBack?: () => void;
  hideIntro?: boolean;
}) {
  const t = useTranslations('checkout');
  const tOnboarding = useTranslations('onboarding');
  const male = readProgramTrack() === 'male';

  return (
    <main
      className={cn(
        'relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden border-x border-white/5 bg-[#0b0b0b] px-5 pb-10 pt-4',
        male ? 'track-male' : 'track-female',
      )}
    >
      <header className="relative flex items-center justify-between pb-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 font-label text-[10px] font-medium uppercase tracking-[0.1em] text-accent"
          >
            ← {tOnboarding('back')}
          </button>
        ) : (
          <BrandMark />
        )}
        {onBack ? <BrandMark /> : null}
        <LocaleSwitcher />
      </header>
      <div className="h-px bg-white/8" />
      {hideIntro ? null : (
        <>
          <p className="relative mt-7 font-label text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
            {eyebrow ?? t('title')}
          </p>
          {title ? (
            <>
              <h1 className="relative mt-2.5 font-heading text-[28px] font-normal uppercase leading-8 tracking-[-0.02em]">
                {title}
              </h1>
              <div className="relative my-2.5 h-px w-15 bg-accent" />
            </>
          ) : null}
        </>
      )}
      <div
        className={cn(
          'relative flex-1',
          hideIntro ? 'mt-8 flex flex-col' : 'mt-5',
        )}
      >
        {children}
      </div>
    </main>
  );
}

type PlanCopy = {
  name: string;
  period: string;
  description: string;
  features: string[];
};

function planCopy(
  t: ReturnType<typeof useTranslations<'marketing'>>,
  kind: CatalogCode,
): PlanCopy {
  switch (kind) {
    case '1_MONTH':
      return {
        name: t('pricing.plans.1_MONTH.name'),
        period: t('pricing.plans.1_MONTH.period'),
        description: t('pricing.plans.1_MONTH.description'),
        features: t.raw('pricing.plans.1_MONTH.features') as string[],
      };
    case '3_MONTHS':
      return {
        name: t('pricing.plans.3_MONTHS.name'),
        period: t('pricing.plans.3_MONTHS.period'),
        description: t('pricing.plans.3_MONTHS.description'),
        features: t.raw('pricing.plans.3_MONTHS.features') as string[],
      };
    case 'FULL_ACCESS':
      return {
        name: t('pricing.plans.FULL_ACCESS.name'),
        period: t('pricing.plans.FULL_ACCESS.period'),
        description: t('pricing.plans.FULL_ACCESS.description'),
        features: t.raw('pricing.plans.FULL_ACCESS.features') as string[],
      };
  }
}
