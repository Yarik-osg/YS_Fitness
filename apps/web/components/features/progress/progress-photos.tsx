'use client';

// Authenticated blob URLs are not a remote pattern next/image can optimize.
/* eslint-disable @next/next/no-img-element */

import type { ProgressPhoto } from '@repo/shared-types';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError } from '@/lib/api/client';
import { getProgressPhotoBlob } from '@/lib/api/users';
import {
  useCreateProgressPhoto,
  useDeleteProgressPhoto,
} from '@/lib/hooks/use-users';
import { readProgressPhoto } from '@/lib/progress-photo';

export function ProgressPhotos({
  loading,
  error,
  photos,
}: {
  loading: boolean;
  error: boolean;
  photos: ProgressPhoto[];
}) {
  const t = useTranslations('progress');
  const create = useCreateProgressPhoto();
  const remove = useDeleteProgressPhoto();
  const { urls, failed, markFailed } = usePhotoUrls(photos);
  const [reading, setReading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const busy = reading || create.isPending;
  const livePicked = picked.filter((id) =>
    photos.some((photo) => photo.id === id),
  );
  const open = photos.find((photo) => photo.id === openId) ?? null;
  const pair = orderedPair(photos, livePicked);

  async function onFile(file: File | undefined) {
    if (!file || busy || photos.length >= 8) return;
    setReading(true);
    setUploadError(null);
    try {
      const imageBase64 = await readProgressPhoto(file);
      create.mutate(
        { imageBase64 },
        {
          onError: (cause) => {
            setUploadError(
              cause instanceof ApiClientError && cause.code === 'PHOTO_LIMIT'
                ? t('photoLimit')
                : t('photoInvalid'),
            );
          },
          onSettled: () => setReading(false),
        },
      );
    } catch {
      setUploadError(t('photoInvalid'));
      setReading(false);
    }
  }

  function choose(id: string) {
    if (!picking) {
      setConfirming(false);
      setOpenId(id);
      return;
    }
    const next = livePicked.includes(id)
      ? livePicked.filter((item) => item !== id)
      : livePicked.length >= 2
        ? livePicked
        : [...livePicked, id];
    setPicked(next);
    if (next.length === 2) {
      setComparing(true);
      setPicking(false);
    }
  }

  function selectForCompare(id: string) {
    setOpenId(null);
    setConfirming(false);
    const next = livePicked.includes(id)
      ? livePicked
      : [...livePicked, id].slice(0, 2);
    setPicked(next);
    setPicking(next.length < 2);
    setComparing(next.length === 2);
  }

  function deleteOpen() {
    if (!open || remove.isPending) return;
    const photo = open;
    const wasSelected = picked.includes(photo.id);
    remove.mutate(photo.id, {
      onSuccess: () => {
        setOpenId(null);
        setConfirming(false);
        setPicked((current) => current.filter((id) => id !== photo.id));
        if (wasSelected) setComparing(false);
      },
      onError: () => toast.error(t('photoDeleteError')),
    });
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm text-muted">{t('photos')}</h2>
        <button
          type="button"
          disabled={photos.length < 2}
          onClick={() => {
            setPicked([]);
            setComparing(false);
            setPicking(true);
          }}
          className="text-xs whitespace-nowrap text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45"
        >
          {t('compare')}
        </button>
      </div>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <p role="alert" className="text-sm text-amber">
          {t('photoLoadError')}
        </p>
      ) : photos.length === 0 ? (
        <p className="mb-3 text-sm text-muted">{t('photoEmpty')}</p>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {photos.map((photo) => {
            const date = formatPhotoDate(photo.createdAt);
            const selected = livePicked.includes(photo.id);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => choose(photo.id)}
                aria-pressed={picking ? selected : undefined}
                className={`overflow-hidden border bg-panel text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected ? 'border-teal' : 'border-line'
                }`}
              >
                {urls[photo.id] && !failed[photo.id] ? (
                  <img
                    alt=""
                    src={urls[photo.id]}
                    className="aspect-3/4 w-full object-cover"
                    onError={() => markFailed(photo.id)}
                  />
                ) : failed[photo.id] ? (
                  <span className="flex aspect-3/4 items-center justify-center px-3 text-center text-xs text-amber">
                    {t('photoImageError')}
                  </span>
                ) : (
                  <Skeleton className="aspect-3/4 w-full" />
                )}
                <span className="block border-t border-line px-3 py-2 text-[10px] text-muted tabular-nums">
                  {date}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {picking ? (
        <p className="mb-3 text-xs text-muted">{t('comparePick')}</p>
      ) : null}
      {!loading && !error && photos.length >= 8 ? (
        <p className="text-xs text-muted">{t('photoLimit')}</p>
      ) : !loading && !error ? (
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-line font-label text-[9px] font-bold tracking-[0.14em] text-muted uppercase has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <Plus aria-hidden="true" className="size-3.5" />
          {busy ? t('saving') : t('addPhoto')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void onFile(file);
            }}
          />
        </label>
      ) : null}
      {uploadError ? (
        <p role="alert" className="mt-3 text-xs text-amber">
          {uploadError}
        </p>
      ) : null}

      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next && !remove.isPending) {
            setOpenId(null);
            setConfirming(false);
          }
        }}
        dismissible={!remove.isPending}
      >
        <SheetContent>
          {open ? (
            confirming ? (
              <>
                <SheetTitle>{t('deletePhoto')}</SheetTitle>
                <SheetDescription>
                  {t('deleteConfirm', {
                    date: formatPhotoDate(open.createdAt),
                  })}
                </SheetDescription>
                <SheetFooter>
                  <Button
                    type="button"
                    disabled={remove.isPending}
                    onClick={deleteOpen}
                  >
                    {remove.isPending ? t('deleting') : t('deletePhoto')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={() => setConfirming(false)}
                  >
                    {t('cancel')}
                  </Button>
                </SheetFooter>
              </>
            ) : (
              <>
                <SheetTitle>{formatPhotoDate(open.createdAt)}</SheetTitle>
                {failed[open.id] ? (
                  <p
                    role="alert"
                    className="mb-4 text-center text-sm text-amber"
                  >
                    {t('photoImageError')}
                  </p>
                ) : urls[open.id] ? (
                  <img
                    alt={formatPhotoDate(open.createdAt)}
                    src={urls[open.id]}
                    className="mx-auto mb-4 max-h-[60vh] w-full object-contain"
                    onError={() => markFailed(open.id)}
                  />
                ) : (
                  <Skeleton className="mb-4 aspect-3/4 w-full" />
                )}
                <SheetFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => selectForCompare(open.id)}
                  >
                    {t('compare')}
                  </Button>
                  <Button type="button" onClick={() => setConfirming(true)}>
                    {t('deletePhoto')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpenId(null)}
                  >
                    {t('close')}
                  </Button>
                </SheetFooter>
              </>
            )
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={comparing && pair !== null}
        onOpenChange={(next) => {
          if (!next) setComparing(false);
        }}
      >
        <SheetContent>
          {pair ? (
            <>
              <SheetTitle>{t('compare')}</SheetTitle>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <CompareFrame
                  label={t('photoBefore')}
                  photo={pair.before}
                  src={urls[pair.before.id]}
                  failed={failed[pair.before.id] === true}
                />
                <CompareFrame
                  label={t('photoAfter')}
                  photo={pair.after}
                  src={urls[pair.after.id]}
                  failed={failed[pair.after.id] === true}
                />
              </div>
              <SheetFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setComparing(false);
                    setPicked([]);
                    setPicking(true);
                  }}
                >
                  {t('chooseDifferent')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setComparing(false)}
                >
                  {t('close')}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CompareFrame({
  label,
  photo,
  src,
  failed,
}: {
  label: string;
  photo: ProgressPhoto;
  src: string | undefined;
  failed: boolean;
}) {
  const t = useTranslations('progress');
  const date = formatPhotoDate(photo.createdAt);
  return (
    <figure>
      {failed ? (
        <p role="alert" className="text-xs text-amber">
          {t('photoImageError')}
        </p>
      ) : src ? (
        <img
          alt={`${label} ${date}`}
          src={src}
          className="max-h-[50vh] w-full object-contain"
        />
      ) : (
        <Skeleton className="aspect-3/4 w-full" />
      )}
      <figcaption className="mt-2 text-xs text-muted">
        <span className="block text-ink">{label}</span>
        <span className="tabular-nums">{date}</span>
      </figcaption>
    </figure>
  );
}

function orderedPair(photos: ProgressPhoto[], picked: string[]) {
  const selected = photos.filter((photo) => picked.includes(photo.id));
  if (selected.length !== 2) return null;
  const [first, second] = [...selected].sort((left, right) => {
    const byDate =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
  });
  if (!first || !second || first.id === second.id) return null;
  return { before: first, after: second };
}

function usePhotoUrls(photos: ProgressPhoto[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const list = photos;
    void (async () => {
      const next: Record<string, string> = {};
      const nextFailed: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (photo) => {
          try {
            const blob = await getProgressPhotoBlob(photo.id);
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            created.push(url);
            next[photo.id] = url;
          } catch {
            if (!cancelled) nextFailed[photo.id] = true;
          }
        }),
      );
      if (cancelled) {
        for (const url of created) URL.revokeObjectURL(url);
        return;
      }
      setUrls(next);
      setFailed(nextFailed);
    })();
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [photos]);

  return {
    urls,
    failed,
    markFailed: (id: string) =>
      setFailed((current) => ({ ...current, [id]: true })),
  };
}

function formatPhotoDate(value: string) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}
