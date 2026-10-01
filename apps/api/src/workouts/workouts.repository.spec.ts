import { describe, expect, it, vi } from 'vitest';
import { WorkoutsRepository } from './workouts.repository.js';

describe('WorkoutsRepository.list', () => {
  it('reads the caller rows newest first', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new WorkoutsRepository({
      workoutLog: { findMany, count: vi.fn() },
    } as never);

    await repository.list('user-1', { limit: 20, offset: 5 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { completedAt: 'desc' },
        skip: 5,
        take: 20,
      }),
    );
  });
});
