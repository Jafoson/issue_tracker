import { redirect } from "next/navigation";
import { getProjects } from "@/features/issues/queries";

export default async function BoardIndexPage() {
  const projects = await getProjects();
  if (projects.length === 0) redirect("/members");
  redirect(`/board/${projects[0].id}`);
}
