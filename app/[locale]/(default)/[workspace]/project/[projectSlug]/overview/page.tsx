import { notFound } from "next/navigation";
import { ProjectDashboard } from "@/features/dashboard/components/ProjectDashboard/ProjectDashboard";
import {
  getMyDashboardLayout,
  getProjectDashboard,
} from "@/features/dashboard/queries";
import { toDashboardScope } from "@/features/dashboard/scope";
import { toProjectView } from "@/features/dashboard/view";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { toRange } from "@/lib/buckets";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { projectPath, projectSettingsPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * Die Startseite eines Projekts, in zwei Ansichten: „Übersicht" mit dem
 * Steckbrief und „Dashboard" mit den Zahlen. Beide kommen aus einem Aufruf,
 * umgeschaltet wird im Client — `?view=` in der Adresse hält den Stand fest.
 *
 * ── Woher Zeitraum und Ansicht kommen ──
 *
 * Beide folgen derselben Rangfolge: erst die Adresse, dann das Konto, dann die
 * Vorgabe. Das ist die richtige Reihenfolge — ein geteilter Link soll zeigen,
 * was der Absender gesehen hat, und nicht das, was der Empfänger sich einmal
 * eingestellt hat. Ohne Adresse gilt, was die Person zuletzt offen hatte: die
 * Projektzeile in der Seitenleiste führt genau hierher, und wer dort zuletzt die
 * Zahlen ansah, will sie beim nächsten Klick nicht erst wieder aufrufen.
 */
export default async function ProjectDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
  searchParams: Promise<{ range?: string; view?: string; scope?: string }>;
}) {
  const { workspace, projectSlug } = await params;
  const {
    range: rangeParam,
    view: viewParam,
    scope: scopeParam,
  } = await searchParams;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  // Ein Aufruf für beides — `getMyDashboardLayout` ist über `cache()` pro
  // Anfrage dedupliziert und wird gleich von `getProjectDashboard` noch einmal
  // gebraucht.
  const stored = await getMyDashboardLayout(project.id);

  const range = toRange(rangeParam ?? stored.range ?? undefined);
  const view = toProjectView(viewParam, stored.view);
  const scope = toDashboardScope(scopeParam, stored.scope);

  const data = await getProjectDashboard(project.id, range, scope);
  if (!data) notFound();

  return (
    <ProjectDashboard
      {...data}
      view={view}
      issueBase={`/${workspace}/issue`}
      links={{
        board: projectPath(workspace, projectSlug, ""),
        list: projectPath(workspace, projectSlug, "list"),
        members: projectPath(workspace, projectSlug, "members"),
        settings: projectSettingsPath(workspace, projectSlug, ""),
      }}
    />
  );
}
