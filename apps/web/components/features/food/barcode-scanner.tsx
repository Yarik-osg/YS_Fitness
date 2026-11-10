'use client';

import type { FoodProductResponse } from '@repo/shared-types';
import { normalizeBarcode } from '@repo/validation';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { isScanFormat } from '@/lib/food/barcode';
import { createScanDetector } from '@/lib/food/barcode-engine';
import { useBarcodeScanner } from '@/lib/hooks/use-barcode-scanner';
import { useFoodBarcodeLookup, type BarcodeLookup } from '@/lib/hooks/use-food';

const FOCUSABLE =
  'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

export function BarcodeLookupPanel({
  lookup,
  code,
  onProduct,
  onCreate,
  onSearchByName,
}: {
  lookup: BarcodeLookup;
  code: string;
  onProduct: (product: FoodProductResponse) => void;
  onCreate: (barcode: string) => void;
  onSearchByName: () => void;
}) {
  const t = useTranslations('food');
  const reported = useRef<string | null>(null);
  const products = lookup.data?.products ?? [];
  const single = products.length === 1 ? products[0] : null;

  useEffect(() => {
    if (!single || reported.current === single.id) return;
    reported.current = single.id;
    onProduct(single);
  }, [onProduct, single]);

  if (lookup.isPending) {
    return <p className="text-sm text-muted">{t('scanLooking')}</p>;
  }
  if (lookup.isError) {
    const slow =
      lookup.error instanceof ApiClientError && lookup.error.status === 429;
    return (
      <div>
        <p role="alert" className="text-sm text-amber">
          {slow ? t('slowDown') : t('scanLookupFailed')}
        </p>
        <Button
          className="mt-2 w-full whitespace-nowrap"
          onClick={() => void lookup.refetch()}
        >
          {t('retry')}
        </Button>
      </div>
    );
  }
  if (!lookup.isSuccess) return null;
  if (products.length === 1) {
    return <p className="text-sm text-muted">{t('scanLooking')}</p>;
  }
  if (products.length > 1) {
    return (
      <ul className="flex flex-col gap-2">
        {products.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onProduct(product)}
              className="text-left text-sm text-ink"
            >
              {product.name}
            </button>
          </li>
        ))}
      </ul>
    );
  }
  if (lookup.data.fromCacheOnly) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink">{t('scanCatalogDown')}</p>
        <Button
          className="w-full whitespace-nowrap"
          onClick={() => void lookup.refetch()}
        >
          {t('retry')}
        </Button>
        <Button
          variant="outline"
          className="w-full whitespace-nowrap"
          onClick={() => onCreate(code)}
        >
          {t('scanCreate')}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink">{t('scanNotFound')}</p>
      <Button
        className="w-full whitespace-nowrap"
        onClick={() => onCreate(code)}
      >
        {t('scanCreate')}
      </Button>
      <Button
        variant="outline"
        className="w-full whitespace-nowrap"
        onClick={onSearchByName}
      >
        {t('scanByName')}
      </Button>
    </div>
  );
}

export function BarcodeScanner({
  onClose,
  onProduct,
  onCreate,
  onSearchByName,
}: {
  onClose: () => void;
  onProduct: (product: FoodProductResponse) => void;
  onCreate: (barcode: string) => void;
  onSearchByName: () => void;
}) {
  const t = useTranslations('food');
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [manualInvalid, setManualInvalid] = useState(false);
  const [photoInvalid, setPhotoInvalid] = useState(false);
  const lookup = useFoodBarcodeLookup(accepted);
  const { bindVideo, phase, canTorch, torch, toggleTorch, restart } =
    useBarcodeScanner(accepted === null, setAccepted);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const items = () =>
      [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (item) => !item.hasAttribute('disabled'),
      );
    if (!root.contains(document.activeElement)) items()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = items();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submitManual() {
    const code = normalizeBarcode(manual);
    if (!code) {
      setManualInvalid(true);
      return;
    }
    setManualInvalid(false);
    setAccepted(code);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoInvalid(false);
    try {
      const { detector } = await createScanDetector();
      const bitmap = await createImageBitmap(file);
      try {
        const hits = await detector.detect(bitmap);
        const match = hits.find(
          (hit) => isScanFormat(hit.format) && normalizeBarcode(hit.rawValue),
        );
        const code = match ? normalizeBarcode(match.rawValue) : null;
        if (!code) {
          setPhotoInvalid(true);
          return;
        }
        setAccepted(code);
      } finally {
        bitmap.close();
      }
    } catch {
      setPhotoInvalid(true);
    }
  }

  const status =
    accepted !== null
      ? lookup.isPending
        ? t('scanLooking')
        : ''
      : phase === 'requesting'
        ? t('scanPermission')
        : phase === 'denied'
          ? t('scanDenied')
          : phase === 'no-camera'
            ? t('scanNoCamera')
            : phase === 'insecure'
              ? t('scanInsecure')
              : phase === 'paused'
                ? t('scanPaused')
                : phase === 'scanning'
                  ? t('scanAlign')
                  : '';

  const scanning = accepted === null && phase === 'scanning';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="absolute inset-0 z-10 flex flex-col bg-background pb-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.25rem))] text-ink"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
        <h2
          id={titleId}
          className="min-w-0 truncate font-label text-xs font-bold tracking-[0.14em] uppercase"
        >
          {t('scanTitle')}
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 whitespace-nowrap"
          onClick={onClose}
        >
          {t('scanClose')}
        </Button>
      </div>
      {scanning ? (
        <div className="relative h-52 shrink-0 bg-background">
          <video
            ref={bindVideo}
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
            <div className="h-36 w-full max-w-sm border-2 border-ink">
              <span className="sr-only">{t('scanFrame')}</span>
            </div>
          </div>
          <p
            aria-live="polite"
            className="absolute inset-x-0 bottom-3 px-5 text-center text-sm text-ink"
          >
            {status}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {status ? (
            <p aria-live="polite" className="text-sm text-muted">
              {status}
            </p>
          ) : null}
          {accepted ? (
            <BarcodeLookupPanel
              lookup={lookup}
              code={accepted}
              onProduct={onProduct}
              onCreate={onCreate}
              onSearchByName={onSearchByName}
            />
          ) : null}
          {accepted && !lookup.isPending ? (
            <Button
              variant="outline"
              className="w-full whitespace-nowrap"
              onClick={() => setAccepted(null)}
            >
              {t('scanAnother')}
            </Button>
          ) : null}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-4">
        {phase === 'paused' ? (
          <Button
            variant="outline"
            className="w-full whitespace-nowrap"
            onClick={restart}
          >
            {t('scanStart')}
          </Button>
        ) : null}
        {canTorch ? (
          <Button
            variant="outline"
            aria-pressed={torch}
            className="w-full whitespace-nowrap"
            onClick={() => void toggleTorch()}
          >
            {torch ? t('scanTorchOff') : t('scanTorchOn')}
          </Button>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          {t('scanManual')}
          <input
            inputMode="numeric"
            value={manual}
            aria-invalid={manualInvalid}
            onChange={(event) => {
              setManual(event.target.value);
              setManualInvalid(false);
            }}
            className="border border-line bg-background px-3 py-2 text-base text-ink"
          />
        </label>
        {manualInvalid ? (
          <p role="alert" className="text-sm text-amber">
            {t('scanInvalid')}
          </p>
        ) : null}
        <Button className="w-full whitespace-nowrap" onClick={submitManual}>
          {t('scanUseTyped')}
        </Button>
        <label
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full whitespace-nowrap focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
          )}
        >
          {t('scanPhoto')}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              input.value = '';
              void onPhoto(file);
            }}
          />
        </label>
        {photoInvalid ? (
          <p role="alert" className="text-sm text-amber">
            {t('scanInvalid')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
