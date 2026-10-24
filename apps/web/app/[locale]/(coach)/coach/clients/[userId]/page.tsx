import { CoachClientPage } from '@/components/features/coach/coach-client-page';

export default async function CoachClientRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <CoachClientPage userId={userId} />;
}
