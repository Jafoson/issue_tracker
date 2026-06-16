import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CreateWorkspaceForm } from "@/features/workspaces/components/CreateWorkspaceForm/CreateWorkspaceForm";

export default async function CreateWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  return <CreateWorkspaceForm locale={locale} />;
}
