const PLAN_STORAGE_KEY = 'ys_selected_plan_id';

export function persistSelectedPlanId(planId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PLAN_STORAGE_KEY, planId);
}

export function readSelectedPlanId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(PLAN_STORAGE_KEY);
}

export function readPlanIdFromQuery(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('planId');
}

export function clearSelectedPlanId() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PLAN_STORAGE_KEY);
}

const TRACK_STORAGE_KEY = 'ys_program_track';

export function persistProgramTrack(track: 'female' | 'male') {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TRACK_STORAGE_KEY, track);
}

export function readProgramTrack(): 'female' | 'male' | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(TRACK_STORAGE_KEY);
  return value === 'female' || value === 'male' ? value : null;
}
