'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { completeMockPayment } from '@/lib/api/subscriptions';

export function CheckoutReturnPage() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const providerReference = searchParams.get('providerReference');
  const expiresAtRaw = searchParams.get('expiresAt');
  const expiresAt = Number(expiresAtRaw);
  const signature = searchParams.get('signature');
  const paramsInvalid =
    !providerReference ||
    !signature ||
    !expiresAtRaw ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= 0;

  useEffect(() => {
    if (paramsInvalid || !providerReference || !signature) {
      return;
    }

    let active = true;
    void completeMockPayment({ providerReference, expiresAt, signature })
      .then(() => {
        if (active) router.replace('/dashboard');
      })
      .catch(() => {
        if (active) setError(t('error'));
      });

    return () => {
      active = false;
    };
  }, [paramsInvalid, providerReference, expiresAt, signature, router, t]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0b0b] px-6">
      <p className="font-label text-[10px] tracking-[0.2em] text-white/50 uppercase">
        {error ?? (paramsInvalid ? t('error') : t('loading'))}
      </p>
    </main>
  );
}
