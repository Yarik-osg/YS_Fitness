import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssignedProgramResponse } from '@repo/shared-types';
import { toProgramSummary } from '@/lib/api/programs';
import {
  assignedProgramQueryKey,
  myProgramQueryKey,
  useAssignProgram,
} from './use-programs';

const program = {
  id: 'program-1',
  templateId: '11111111-1111-4111-8111-111111111111',
  templateCode: 'WB2U',
  templateName: 'WB2U — test',
  gender: 'female',
  level: 'beginner',
  frequencyPerWeek: 2,
  accent: 'UPPER',
  assignedAt: '2026-09-27T00:00:00.000Z',
  nextDayNumber: 1,
  programProgress: { completed: 0, expected: 16 },
  days: [{ dayNumber: 1, exercises: [] }],
} satisfies AssignedProgramResponse;

const api = vi.hoisted(() => ({
  assignProgram: vi.fn(),
}));

vi.mock('@/lib/api/programs', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/programs')>(
      '@/lib/api/programs',
    );
  return {
    ...actual,
    assignProgram: api.assignProgram,
  };
});

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe('useAssignProgram', () => {
  afterEach(() => {
    api.assignProgram.mockReset();
  });

  it('writes both the dashboard and profile program caches', async () => {
    api.assignProgram.mockResolvedValue(program);
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });

    const { result } = renderHook(() => useAssignProgram(), {
      wrapper: wrapper(client),
    });
    result.current.mutate();

    await waitFor(() => {
      expect(client.getQueryData(myProgramQueryKey)).toEqual(program);
    });
    expect(client.getQueryData(assignedProgramQueryKey)).toEqual(
      toProgramSummary(program),
    );
    expect(client.getQueryData(assignedProgramQueryKey)).not.toHaveProperty(
      'days',
    );
  });
});
