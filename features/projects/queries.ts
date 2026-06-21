import { cache } from "react";
import { db } from "@/lib/db";
import type { Project } from "@/types";

export interface ProjectWithStats extends Project {
  issueCount: number;
}

export const getProjectsWithStats = cache(async (workspaceId: string): Promise<ProjectWithStats[]> => {
  const projects = await db.project.findMany({
    where: { workspaceId },
    include: { _count: { select: { issues: true } } },
    orderBy: { name: "asc" },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    prefix: p.prefix,
    color: p.color,
    issueCount: p._count.issues,
  }));
});
