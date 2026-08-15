"use client";

import type { IssueComposerData } from "@/features/issues/types";
import { useRouter } from "@/i18n/navigation";
import { projectPath } from "@/lib/nav";
import type { IssueDetail } from "@/types";
import { IssueDetailPageView } from "./IssueDetailPageView";
import { useIssueDetail } from "./useIssueDetail";

interface IssueDetailPageProps {
  /** Vom Server geladen — die Seite fängt nie leer an. */
  issue: IssueDetail;
  data: IssueComposerData;
}

/**
 * Die Vollseite unter `/[workspace]/issue/[ref]`.
 *
 * Sie teilt sich mit dem Seitenpanel den Hook, nicht die Hülle: geladen und
 * geschrieben wird gleich, dargestellt nicht. Ein Panel liegt über einer Liste
 * und lässt sich schließen — eine Seite steht für sich und führt zurück.
 */
export function IssueDetailPage({ issue, data }: IssueDetailPageProps) {
  const router = useRouter();
  const project = data.projects.find((p) => p.id === issue.project) ?? null;

  // Wohin es zurückgeht: zum Projekt des Issues, nicht in die Browser-Historie
  // — ein Link, der auch dann trägt, wenn die Seite direkt aufgerufen wurde.
  const backHref = project
    ? projectPath(data.workspaceId, project.slug, "")
    : `/${data.workspaceId}`;

  const {
    issue: current,
    patch,
    comment,
    remove,
  } = useIssueDetail({
    issueRef: issue.id,
    data,
    initialIssue: issue,
    // Gelöscht heißt hier: die Seite zeigt nichts mehr. Also weiter zum Projekt.
    onDeleted: () => router.push(backHref),
  });

  return (
    <IssueDetailPageView
      issue={current ?? issue}
      project={project}
      data={data}
      backHref={backHref}
      onPatch={patch}
      onComment={comment}
      onDelete={remove}
    />
  );
}
