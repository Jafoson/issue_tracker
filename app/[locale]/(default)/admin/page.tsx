import { PlatformOverview } from "@/features/admin/components/PlatformOverview/PlatformOverview";
import { getPlatformStats } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const stats = await getPlatformStats();
  return <PlatformOverview stats={stats} />;
}
