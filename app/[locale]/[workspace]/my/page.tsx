import { redirect } from "next/navigation";
import { MyIssues } from "@/features/issues/components/MyIssues/MyIssues";
import { getMyIssues } from "@/features/issues/queries";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const issues = await getMyIssues(session.userId, workspace);
  return <MyIssues issues={issues} />;
}
