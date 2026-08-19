// ─── Konto-Anlage: Domain-Auto-Join ─────────────────────────────────────────
//
// Was passiert, sobald ein Konto zum ersten Mal existiert — unabhängig davon,
// über welchen Weg (Passwort früher, künftig Magic Link/OIDC/Passkey/LDAP).
// Trifft die Domain der Adresse einen per `addWorkspaceDomain()` beanspruchten
// Workspace, tritt das Konto ihm sofort bei, ohne Einladungslink und ohne
// `pending` — dieselbe Regel wie bisher in `register()`, jetzt an einer
// Stelle statt an einer pro Anmeldeweg.

import type { Prisma } from "@/lib/generated/prisma/client";
import { enrollInWorkspaceProjects } from "@/lib/project-membership";
import { DEFAULT_WORKSPACE_ROLE_KEY, systemRoleId } from "@/lib/rbac";

/** Passt auf den Prisma-Client wie auf einen Transaktions-Client. */
type Db = Prisma.TransactionClient;

/**
 * Ordnet ein frisch angelegtes Konto einem Workspace zu, falls dessen
 * E-Mail-Domain beansprucht ist. Kein Treffer heißt: nichts zu tun, das Konto
 * bleibt vorerst ohne Workspace (`/create-workspace`).
 */
export async function provisionNewUser(
  db: Db,
  data: { userId: string; email: string },
): Promise<void> {
  const domain = data.email.split("@")[1] ?? "";

  const claim = await db.workspaceDomain.findUnique({
    where: { domain },
    select: { workspaceId: true },
  });
  if (!claim) return;

  await db.workspaceMember.create({
    data: {
      workspaceId: claim.workspaceId,
      userId: data.userId,
      roleId: systemRoleId("WORKSPACE", DEFAULT_WORKSPACE_ROLE_KEY),
      pending: false,
    },
  });
  await enrollInWorkspaceProjects(db, {
    workspaceId: claim.workspaceId,
    userId: data.userId,
  });
}
