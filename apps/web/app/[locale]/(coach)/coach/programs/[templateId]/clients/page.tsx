import { CoachProgramClientsPage } from '@/components/features/coach/coach-program-clients-page';

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <CoachProgramClientsPage templateId={templateId} />;
}
