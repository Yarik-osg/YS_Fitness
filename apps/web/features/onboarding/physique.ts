import type { ProgramTrack } from './program-track';

/** Placeholder silhouettes — swap files in /marketing/body-slider without changing the component. */
export const PHYSIQUE_STEPS = 10;

export const PHYSIQUE_VALUES = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
] as const;

export type PhysiqueLevel = (typeof PHYSIQUE_VALUES)[number];

export function physiqueIndex(value?: string) {
  if (value === undefined) return null;
  const index = (PHYSIQUE_VALUES as readonly string[]).indexOf(value);
  return index < 0 ? null : index;
}

export function physiqueValue(index: number): PhysiqueLevel {
  return PHYSIQUE_VALUES[snapPhysiquePosition(index)] ?? '0';
}

export function physiqueAsset(track: ProgramTrack, index: number) {
  return `/marketing/body-slider/${track}-${snapPhysiquePosition(index)}.svg`;
}

export function clampPhysiquePosition(position: number) {
  return Math.min(PHYSIQUE_STEPS - 1, Math.max(0, position));
}

export function snapPhysiquePosition(position: number) {
  return Math.round(clampPhysiquePosition(position));
}

export function nearestPhysiqueLayers(
  position: number,
  reducedMotion: boolean,
) {
  const clamped = clampPhysiquePosition(position);
  if (reducedMotion) {
    return [{ index: snapPhysiquePosition(clamped), opacity: 1 }];
  }

  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  if (lower === upper) {
    return [{ index: lower, opacity: 1 }];
  }

  const fraction = clamped - lower;
  return [
    { index: lower, opacity: 1 - fraction },
    { index: upper, opacity: fraction },
  ];
}
