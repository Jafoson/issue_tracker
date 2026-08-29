import { NextResponse } from "next/server";
import { getIssueById, getIssueByRef } from "@/features/issues/queries";
import { currentUserId, hasPermission } from "@/lib/permissions";

const REF = /^[A-Za-z0-9]+-\d+$/;

// This route lies outside the middleware matcher (`proxy.ts` excludes
// `/api`) — so the app's auth gate doesn't apply here. It therefore checks
// both things itself: a session must exist, and the issue's project must be
// visible.
//
// A missing permission responds the same as a missing issue: 404, not 403.
// Otherwise the response would reveal that the issue exists.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const notFound = NextResponse.json(null, { status: 404 });

  if (!(await currentUserId())) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  const ws = new URL(req.url).searchParams.get("ws");

  // The path segment is either an internal issue id or a "PREFIX-123" ref.
  // Both paths already filter on `project.view` inside the query; the check
  // below is still here because it belongs to this route, not to an
  // implementation detail of the query.
  const issue =
    REF.test(id) && ws ? await getIssueByRef(ws, id) : await getIssueById(id);

  if (!issue) return notFound;
  if (!(await hasPermission("project.view", { projectId: issue.project })))
    return notFound;

  return NextResponse.json(issue);
}
