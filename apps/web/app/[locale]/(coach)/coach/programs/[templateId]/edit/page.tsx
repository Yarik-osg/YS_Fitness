import { CoachProgramEditor } from '@/components/features/coach/coach-program-editor';

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <CoachProgramEditor templateId={templateId} />;
}
