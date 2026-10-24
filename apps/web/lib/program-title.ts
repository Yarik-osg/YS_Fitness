'use client';

import type { ProgramAccent } from '@repo/shared-types';
import { useTranslations } from 'next-intl';

const PROGRAM_ACCENTS: Record<ProgramAccent, true> = {
  NONE: true,
  UPPER: true,
  LOWER: true,
  BACK: true,
  CHEST: true,
  SHOULDERS: true,
  ARMS: true,
  LEGS: true,
};

export function programAccentKey(accent: string): ProgramAccent | null {
  return Object.hasOwn(PROGRAM_ACCENTS, accent)
    ? (accent as ProgramAccent)
    : null;
}

export function programTitle(
  accent: string,
  titleFor: (accent: ProgramAccent) => string,
  fallback: string,
): string {
  const key = programAccentKey(accent);
  return key ? titleFor(key) : fallback;
}

export function useProgramTitle(accent: string): string {
  const home = useTranslations('dashboard.home');
  return programTitle(
    accent,
    (key) => home(`promotion.programs.${key}`),
    home('programFallback'),
  );
}
