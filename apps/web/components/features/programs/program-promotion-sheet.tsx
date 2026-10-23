'use client';

import {
  expectedProgramSessions,
  type ProgramAccent,
  type ProgramPromotion,
} from '@repo/shared-types';
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
import { ERROR_DURATION_MS } from '@/components/ui/toaster';
import {
  useAcceptPromotion,
  useProgramPromotion,
} from '@/lib/hooks/use-programs';

export function ProgramPromotionSheet({ enabled }: { enabled: boolean }) {
  const promotion = useProgramPromotion(enabled);
  const accept = useAcceptPromotion();
  const t = useTranslations('dashboard');
  const offer = enabled ? (promotion.data ?? null) : null;
  const offerKey = offer
    ? `${offer.kind}:${offer.suggestions.map((item) => item.id).join(',')}`
    : null;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const open = offerKey !== null && dismissedKey !== offerKey;

  useEffect(() => {
    if (!enabled || !promotion.isError) return;
    toast.error(t('home.promotion.loadError'), {
      id: 'program-promotion-load',
      duration: ERROR_DURATION_MS,
    });
  }, [enabled, promotion.isError, promotion.errorUpdatedAt, t]);

  function close() {
    if (accept.isPending || !offerKey) return;
    setDismissedKey(offerKey);
  }

  function choose(templateId: string) {
    if (accept.isPending) return;
    accept.mutate(templateId, {
      onSuccess: () => toast.success(t('workouts.assigned')),
      onError: () =>
        toast.error(t('workouts.assignError'), { duration: ERROR_DURATION_MS }),
    });
  }

  return (
    <Sheet
      open={open}
      dismissible={!accept.isPending}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <SheetContent>
        {offer ? (
          <PromotionBody
            offer={offer}
            busy={accept.isPending}
            onChoose={choose}
            onClose={close}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PromotionBody({
  offer,
  busy,
  onChoose,
  onClose,
}: {
  offer: ProgramPromotion;
  busy: boolean;
  onChoose: (templateId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('dashboard');
  const suggestion = offer.suggestions[0];
  const title =
    offer.suggestions.length === 0
      ? t('home.promotion.emptyTitle')
      : offer.kind === 'zone-change'
        ? t('home.promotion.zoneTitle')
        : t('home.promotion.levelUpTitle');
  const body =
    offer.suggestions.length === 0
      ? t('home.promotion.emptyBody')
      : offer.kind === 'zone-change'
        ? t('home.promotion.zoneBody')
        : t('home.promotion.levelUpBody');

  return (
    <>
      <SheetTitle className="text-left text-xl">{title}</SheetTitle>
      <SheetDescription
        className={
          suggestion ? 'mb-4 text-left text-base' : 'text-left text-base'
        }
      >
        {body}
      </SheetDescription>
      {suggestion ? (
        <dl className="mb-7 flex flex-col gap-2">
          <OverviewRow
            label={t('home.promotion.level')}
            value={levelChange(offer, (level) => t(`home.levels.${level}`))}
          />
          {offer.kind === 'level-up' ? (
            <OverviewRow
              label={t('home.promotion.focus')}
              value={promotionLabel('accents', suggestion.accent, t)}
            />
          ) : null}
          <OverviewRow
            label={t('home.perWeek')}
            value={t('home.times', { count: suggestion.frequencyPerWeek })}
          />
          <OverviewRow
            label={t('home.promotion.nextBlock')}
            value={t('home.sessionCount', {
              completed: 0,
              expected: expectedProgramSessions(suggestion.frequencyPerWeek),
            })}
          />
        </dl>
      ) : null}
      <SheetFooter>
        {offer.kind === 'level-up' && suggestion ? (
          <Button
            className="w-full text-sm"
            disabled={busy}
            onClick={() => onChoose(suggestion.id)}
          >
            {t('home.promotion.confirm')}
          </Button>
        ) : null}
        {offer.kind === 'zone-change'
          ? offer.suggestions.map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-white/55">
                  {promotionLabel('accents', item.accent, t)}
                </p>
                <Button
                  className="w-full px-3 text-sm tracking-[0.06em] whitespace-normal"
                  disabled={busy}
                  onClick={() => onChoose(item.id)}
                >
                  {promotionLabel('programs', item.accent, t)}
                </Button>
              </div>
            ))
          : null}
        <Button
          variant="outline"
          className="w-full text-sm"
          disabled={busy}
          onClick={onClose}
        >
          {t('home.promotion.close')}
        </Button>
      </SheetFooter>
    </>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm font-medium text-white/55">{label}</dt>
      <dd className="font-label text-sm font-bold tracking-[0.06em] text-white uppercase tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function levelChange(
  offer: ProgramPromotion,
  levelName: (level: ProgramPromotion['fromLevel']) => string,
) {
  const from = levelName(offer.fromLevel);
  const to = levelName(offer.toLevel);
  return from === to ? to : `${from} → ${to}`;
}

function promotionLabel(
  group: 'accents' | 'programs',
  accent: ProgramAccent,
  t: ReturnType<typeof useTranslations<'dashboard'>>,
) {
  return t(`home.promotion.${group}.${accent}`);
}
