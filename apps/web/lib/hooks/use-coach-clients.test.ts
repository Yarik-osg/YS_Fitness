import { describe, expect, it } from 'vitest';
import { isArchiveRefreshKey } from './use-coach-clients';

describe('isArchiveRefreshKey', () => {
  it('refreshes the roster and that client file only', () => {
    expect(isArchiveRefreshKey(['coach', 'clients'], 'client-1')).toBe(true);
    expect(
      isArchiveRefreshKey(['coach', 'clients', 'client-1'], 'client-1'),
    ).toBe(true);
    expect(
      isArchiveRefreshKey(
        ['coach', 'clients', 'client-1', 'workouts'],
        'client-1',
      ),
    ).toBe(false);
    expect(
      isArchiveRefreshKey(['coach', 'clients', 'client-2'], 'client-1'),
    ).toBe(false);
    expect(isArchiveRefreshKey(['coach', 'programs'], 'client-1')).toBe(false);
  });
});
