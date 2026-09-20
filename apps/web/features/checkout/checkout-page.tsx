'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import type { SubscriptionResponse } from '@repo/shared-types';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BrandMark } from '@/components/auth/auth-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiClientError } from '@/lib/api/client';
import { getUserFacingError } from '@/lib/api/errors';
import { getMySubscription } from '@/lib/api/subscriptions';
import { useCheckout } from '@/lib/hooks/use-subscriptions';
import {
  clearSelectedPlanId,
  readSelectedPlanId,
} from '@/lib/subscriptions/selected-plan';

export function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFrame>{null}</CheckoutFrame>}>
      <CheckoutFlow />
    </Suspense>
  );
}

function CheckoutFlow() {
  const searchParams = useSearchParams();
  const checkout = useCheckout();
  const t = useTranslations('checkout');
  const tAuth = useTranslations('auth');
  const planId = searchParams.get('planId') ?? readSelectedPlanId();
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(false);
  const checkoutPlan = checkout.mutateAsync;

  useEffect(() => {
    if (!planId || started.current) return;
    started.current = true;

    void (async () => {
      try {
        try {
          const existing = await getMySubscription();
          if (
            existing &&
            (existing.status === 'ACTIVE' || existing.status === 'PENDING')
          ) {
            setSubscription(existing);
            return;
          }
        } catch {
          // A missing current subscription should not block checkout.
        }

        const result = await checkoutPlan(planId);
        clearSelectedPlanId();
        setSubscription(result.subscription);
      } catch (cause) {
        if (
          cause instanceof ApiClientError &&
          cause.code === 'SUBSCRIPTION_ALREADY_ACTIVE'
        ) {
          const mine = await getMySubscription().catch(() => null);
          if (mine) {
            setSubscription(mine);
            return;
          }
        }
        setError(getUserFacingError(cause, tAuth) || t('error'));
      }
    })();
  }, [attempt, checkoutPlan, planId, t, tAuth]);

  if (!planId) {
    return (
      <CheckoutFrame>
        <p className="text-sm text-muted">{t('missingPlan')}</p>
        <Link href="/" className="mt-8 inline-block w-full">
          <Button className="w-full">{t('choosePlanCta')}</Button>
        </Link>
      </CheckoutFrame>
    );
  }

  if (error) {
    return (
      <CheckoutFrame>
        <p className="text-sm text-muted">{error}</p>
        <Button
          className="mt-8 w-full"
          onClick={() => {
            started.current = false;
            setError(null);
            setAttempt((current) => current + 1);
          }}
        >
          {t('retry')}
        </Button>
      </CheckoutFrame>
    );
  }

  if (!subscription) {
    return (
      <CheckoutFrame>
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
          {t('loading')}
        </p>
        <div className="mx-auto mt-8 h-1 w-48 overflow-hidden bg-line">
          <div className="h-full w-2/3 animate-pulse bg-accent" />
        </div>
      </CheckoutFrame>
    );
  }

  return <CheckoutSuccess subscription={subscription} />;
}

function CheckoutSuccess({
  subscription,
}: {
  subscription: SubscriptionResponse;
}) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const periodEnd = formatPeriodEnd(subscription.currentPeriodEnd, locale);

  return (
    <CheckoutFrame>
      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-accent">
        {t('eyebrow')}
      </p>
      <h1 className="mt-3 font-heading text-4xl uppercase leading-tight">
        {t('successTitle')}
      </h1>
      <p className="mt-5 text-sm leading-6 text-muted">
        {t('successBody', { plan: subscription.plan.name, periodEnd })}
      </p>
      <Link href="/dashboard" className="mt-8 inline-block w-full">
        <Button className="w-full">{t('dashboardCta')}</Button>
      </Link>
    </CheckoutFrame>
  );
}

function CheckoutFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations('checkout');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-white/5 px-6 pb-10 pt-8">
      <header className="flex items-center justify-between">
        <BrandMark />
        <LocaleSwitcher />
      </header>
      <p className="mt-16 font-label text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">
        {t('title')}
      </p>
      <div className="mt-6 flex-1">{children}</div>
    </main>
  );
}

function formatPeriodEnd(value: string | null, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(value));
}
