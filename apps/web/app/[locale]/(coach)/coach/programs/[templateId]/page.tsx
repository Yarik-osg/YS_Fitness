import { CoachProgramPage } from '@/components/features/coach/coach-program-page';

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <CoachProgramPage templateId={templateId} />;
}
