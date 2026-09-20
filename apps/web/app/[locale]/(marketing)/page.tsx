import { cookies } from 'next/headers';
import { LandingPage } from '@/features/marketing/landing-page';
import { parseSessionHint } from '@/lib/auth/session-cookie';

export default async function MarketingPage() {
  const hint = parseSessionHint((await cookies()).get('ys_web_session')?.value);
  return <LandingPage sessionHint={hint} />;
}
