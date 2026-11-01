import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyNutritionCalculation,
  getCoachNutrition,
  listCoachNutritionRoster,
  setManualNutritionTarget,
} from '@/lib/api/coach';
import {
  useApplyNutritionCalculation,
  useCoachNutrition,
  useCoachNutritionRoster,
  useSetManualNutritionTarget,
} from './use-coach-clients';

vi.mock('@/lib/api/coach', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/coach')>('@/lib/api/coach');
  return {
    ...actual,
    getCoachNutrition: vi.fn(),
    listCoachNutritionRoster: vi.fn(),
    setManualNutritionTarget: vi.fn(),
    applyNutritionCalculation: vi.fn(),
  };
});

const target = {
  id: 'target-1',
  source: 'MANUAL' as const,
  calculationId: null,
  targetCalories: '1900',
  proteinGrams: '140',
  fatGrams: '55',
  carbsGrams: '160',
};

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('nutrition target mutations', () => {
  beforeEach(() => {
    vi.mocked(getCoachNutrition).mockReset();
    vi.mocked(listCoachNutritionRoster).mockReset();
    vi.mocked(setManualNutritionTarget).mockReset();
    vi.mocked(applyNutritionCalculation).mockReset();
    vi.mocked(getCoachNutrition).mockResolvedValue({
      calculation: null,
      target: null,
    });
    vi.mocked(listCoachNutritionRoster).mockResolvedValue({ clients: [] });
    vi.mocked(setManualNutritionTarget).mockResolvedValue(target);
    vi.mocked(applyNutritionCalculation).mockResolvedValue(target);
  });

  it('refreshes the client card and the roster after a target write', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    });
    const bound = wrapper(queryClient);
    const card = renderHook(() => useCoachNutrition('user-1'), {
      wrapper: bound,
    });
    const roster = renderHook(() => useCoachNutritionRoster(), {
      wrapper: bound,
    });
    await waitFor(() => expect(card.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(roster.result.current.isSuccess).toBe(true));

    const manual = renderHook(() => useSetManualNutritionTarget('user-1'), {
      wrapper: bound,
    });
    await manual.result.current.mutateAsync({
      targetCalories: '1900',
      proteinGrams: '140',
      fatGrams: '55',
      carbsGrams: '160',
    });
    await waitFor(() => expect(getCoachNutrition).toHaveBeenCalledTimes(2));
    expect(listCoachNutritionRoster).toHaveBeenCalledTimes(2);

    const apply = renderHook(() => useApplyNutritionCalculation('user-1'), {
      wrapper: bound,
    });
    await apply.result.current.mutateAsync('calc-1');
    await waitFor(() => expect(getCoachNutrition).toHaveBeenCalledTimes(3));
    expect(listCoachNutritionRoster).toHaveBeenCalledTimes(3);
  });
});
