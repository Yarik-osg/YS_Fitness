/** Browser-safe web environment values. Only NEXT_PUBLIC_* values may be exposed here. */
export const publicApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
