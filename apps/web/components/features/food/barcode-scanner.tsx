'use client';

import type { FoodProductResponse } from '@repo/shared-types';
import { normalizeBarcode } from '@repo/validation';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { ApiClientError } from '@/lib/api/client';
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
        <button
          type="button"
          onClick={() => void lookup.refetch()}
          className="mt-2 text-sm text-teal"
        >
          {t('retry')}
        </button>
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
        <button
          type="button"
          onClick={() => void lookup.refetch()}
          className="text-left text-sm text-teal"
        >
          {t('retry')}
        </button>
        <button
          type="button"
          onClick={() => onCreate(code)}
          className="text-left text-sm text-teal"
        >
          {t('scanCreate')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink">{t('scanNotFound')}</p>
      <button
        type="button"
        onClick={() => onCreate(code)}
        className="text-left text-sm text-teal"
      >
        {t('scanCreate')}
      </button>
      <button
        type="button"
        onClick={onSearchByName}
        className="text-left text-sm text-teal"
      >
        {t('scanByName')}
      </button>
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
    items()[0]?.focus();
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

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex flex-col bg-background text-ink"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h2
          id={titleId}
          className="font-label text-xs font-bold tracking-[0.14em] uppercase"
        >
          {t('scanTitle')}
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-teal">
          {t('scanClose')}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-8">
        <p aria-live="polite" className="text-sm text-muted">
          {status}
        </p>
        {accepted === null && phase === 'scanning' ? (
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden border border-line">
            <video
              ref={bindVideo}
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-8 border border-white">
              <span className="sr-only">{t('scanFrame')}</span>
            </div>
          </div>
        ) : null}
        {phase === 'paused' ? (
          <button
            type="button"
            onClick={restart}
            className="text-left text-sm text-teal"
          >
            {t('scanStart')}
          </button>
        ) : null}
        {canTorch ? (
          <button
            type="button"
            aria-pressed={torch}
            onClick={() => void toggleTorch()}
            className="text-left text-sm text-teal"
          >
            {torch ? t('scanTorchOff') : t('scanTorchOn')}
          </button>
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
            className="border border-line bg-background px-3 py-2 text-ink"
          />
        </label>
        {manualInvalid ? (
          <p role="alert" className="text-sm text-amber">
            {t('scanInvalid')}
          </p>
        ) : null}
        <button
          type="button"
          onClick={submitManual}
          className="text-left text-sm text-teal"
        >
          {t('scanUseTyped')}
        </button>
        <label className="text-sm text-teal">
          {t('scanPhoto')}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => void onPhoto(event.target.files?.[0])}
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
