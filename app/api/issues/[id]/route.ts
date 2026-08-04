import { NextResponse } from "next/server";
import { getIssueById, getIssueByRef } from "@/features/issues/queries";
import { currentUserId, hasPermission } from "@/lib/permissions";

const REF = /^[A-Za-z0-9]+-\d+$/;

// Diese Route liegt außerhalb des Middleware-Matchers (`proxy.ts` klammert
// `/api` aus) — das Auth-Gate der App greift hier also nicht. Sie prüft
// deshalb selbst, und zwar beides: eine Session muss da sein, und das Projekt
// des Issues muss sichtbar sein.
//
// Ein fehlendes Recht antwortet wie ein fehlendes Issue: 404, nicht 403. Sonst
// verriete die Antwort, dass es das Issue gibt.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const notFound = NextResponse.json(null, { status: 404 });

  if (!(await currentUserId())) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  const ws = new URL(req.url).searchParams.get("ws");

  // The path segment is either an internal issue id or a "PREFIX-123" ref.
  // Beide Wege filtern schon in der Query auf `project.view`; die Prüfung
  // darunter steht trotzdem, weil sie zu dieser Route gehört und nicht zu einer
  // Implementierungseigenschaft der Query.
  const issue =
    REF.test(id) && ws ? await getIssueByRef(ws, id) : await getIssueById(id);

  if (!issue) return notFound;
  if (!(await hasPermission("project.view", { projectId: issue.project })))
    return notFound;

  return NextResponse.json(issue);
}
