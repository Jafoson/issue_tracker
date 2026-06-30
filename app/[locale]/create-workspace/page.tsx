import { redirect } from "next/navigation";
import { CreateWorkspaceForm } from "@/features/workspaces/components/CreateWorkspaceForm/CreateWorkspaceForm";
import { getSession } from "@/lib/session";

export default async function CreateWorkspacePage() {
  return <CreateWorkspaceForm />;
}
