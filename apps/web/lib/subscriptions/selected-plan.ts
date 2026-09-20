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
