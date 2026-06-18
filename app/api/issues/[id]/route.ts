import { NextResponse } from "next/server";
import { getIssueById, getIssueByRef } from "@/features/issues/queries";

const REF = /^[A-Za-z0-9]+-\d+$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = new URL(req.url).searchParams.get("ws");

  // The path segment is either an internal issue id or a "PREFIX-123" ref.
  const issue =
    REF.test(id) && ws ? await getIssueByRef(ws, id) : await getIssueById(id);

  if (!issue) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(issue);
}
