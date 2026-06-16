import { NextResponse } from "next/server";
import { getIssueById } from "@/features/issues/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await getIssueById(id);
  if (!issue) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(issue);
}
