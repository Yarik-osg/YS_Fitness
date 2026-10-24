import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/middleware', () => ({
  default: () => () => new Response(null, { status: 200 }),
}));

import { proxy } from './proxy';

function request(path: string, hint?: string) {
  const headers = new Headers();
  if (hint) headers.set('cookie', `ys_web_session=${hint}`);
  return new NextRequest(new URL(path, 'http://localhost:3000'), { headers });
}

describe('proxy session hint', () => {
  it('sends a coach cookie from onboarding to the roster', () => {
    const response = proxy(request('/en/onboarding', 'coach'));

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/en/coach',
    );
  });

  it('leaves a coach on the roster', () => {
    const response = proxy(request('/en/coach', 'coach'));

    expect(response.headers.get('location')).toBeNull();
  });
});
