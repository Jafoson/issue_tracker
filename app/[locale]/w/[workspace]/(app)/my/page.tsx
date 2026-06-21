import { MyIssues } from "@/features/issues/components/MyIssues/MyIssues";
import { getMembers, getMyIssues } from "@/features/issues/queries";

export const dynamic = "force-dynamic";

export default async function MyPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const members = await getMembers(workspace);
  const me = members.find((m) => m.role === "admin") ?? members[0];
  if (!me) return <MyIssues issues={[]} />;
  const issues = await getMyIssues(me.id, workspace);
  return <MyIssues issues={issues} />;
}
