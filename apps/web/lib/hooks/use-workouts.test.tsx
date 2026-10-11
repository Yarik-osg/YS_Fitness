import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  assignedProgramQueryKey,
  myProgramQueryKey,
} from '@/lib/hooks/use-programs';
import { useLogWorkout, workoutLogsQueryKey } from './use-workouts';

vi.mock('@/lib/api/workouts', () => ({
  listWorkoutLogs: vi.fn(),
  logWorkout: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

describe('useLogWorkout', () => {
  it('refreshes the program cycle along with the logs', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
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
      ]),
    );
  });
});
