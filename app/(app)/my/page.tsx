import { getMembers, getMyIssues } from "@/features/issues/queries";
import { MyIssues } from "@/features/issues/components/MyIssues/MyIssues";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const members = await getMembers();
  const me = members.find((m) => m.role === "admin") ?? members[0];
  if (!me) return <MyIssues issues={[]} />;
  const issues = await getMyIssues(me.id);
  return <MyIssues issues={issues} />;
}
