import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkoutCalendar } from '@/lib/api/workouts';
import {
  assignedProgramQueryKey,
  myProgramQueryKey,
  promotionQueryKey,
} from '@/lib/hooks/use-programs';
import {
  useLogWorkout,
  useWorkoutCalendar,
  workoutLogsQueryKey,
} from './use-workouts';

vi.mock('@/lib/api/workouts', () => ({
  listWorkoutLogs: vi.fn(),
  getWorkoutCalendar: vi.fn(),
  logWorkout: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

const range = {
  from: '2026-10-04T21:00:00.000Z',
  to: '2026-10-11T21:00:00.000Z',
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useWorkoutCalendar', () => {
  beforeEach(() => {
    vi.mocked(getWorkoutCalendar).mockReset();
    vi.mocked(getWorkoutCalendar).mockResolvedValue({ logs: [] });
  });

  it('requests the range and refreshes after a workout is logged', async () => {
    const queryClient = new QueryClient();
    const wrapper = createWrapper(queryClient);

    const calendar = renderHook(() => useWorkoutCalendar(range), { wrapper });
    await waitFor(() => expect(calendar.result.current.isSuccess).toBe(true));
    expect(getWorkoutCalendar).toHaveBeenCalledWith(range.from, range.to);
    expect(getWorkoutCalendar).toHaveBeenCalledTimes(1);

    const log = renderHook(() => useLogWorkout(), { wrapper });
    await act(() =>
      log.result.current.mutateAsync({
        templateId: '11111111-1111-4111-8111-111111111111',
        dayNumber: 1,
        sets: [],
      }),
    );

    await waitFor(() => expect(getWorkoutCalendar).toHaveBeenCalledTimes(2));
  });

  it('keeps each range in its own cache entry', async () => {
    const queryClient = new QueryClient();
    const wrapper = createWrapper(queryClient);
    const other = {
      from: '2026-09-27T21:00:00.000Z',
      to: '2026-10-04T21:00:00.000Z',
    };

    const first = renderHook(() => useWorkoutCalendar(range), { wrapper });
    const second = renderHook(() => useWorkoutCalendar(other), { wrapper });
    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true);
      expect(second.result.current.isSuccess).toBe(true);
    });

    expect(getWorkoutCalendar).toHaveBeenCalledWith(range.from, range.to);
    expect(getWorkoutCalendar).toHaveBeenCalledWith(other.from, other.to);
    expect(getWorkoutCalendar).toHaveBeenCalledTimes(2);
  });

  it('does not request while disabled', () => {
    const queryClient = new QueryClient();

    const { result } = renderHook(
      () => useWorkoutCalendar({ ...range, enabled: false }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(getWorkoutCalendar).not.toHaveBeenCalled();
  });
});

describe('useLogWorkout', () => {
  it('refreshes the program cycle along with the logs', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() =>
      result.current.mutateAsync({
        templateId: '11111111-1111-4111-8111-111111111111',
        dayNumber: 1,
        sets: [],
      }),
    );

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        workoutLogsQueryKey,
        myProgramQueryKey,
        assignedProgramQueryKey,
        promotionQueryKey,
      ]),
    );
  });
});
