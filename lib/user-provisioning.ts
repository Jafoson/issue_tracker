// ─── Account creation: domain auto-join ────────────────────────────────────
//
// What happens the moment an account exists for the first time —
// regardless of which path (password before, magic link/OIDC/passkey/LDAP
// going forward). If the address's domain matches a workspace claimed via
// `addWorkspaceDomain()`, the account joins it immediately, with no invite
// link and no `pending` — the same rule as before in `register()`, now in
// one place instead of one per sign-in method.

import type { Prisma } from "@/lib/generated/prisma/client";
import { enrollInWorkspaceProjects } from "@/lib/project-membership";
import { DEFAULT_WORKSPACE_ROLE_KEY, systemRoleId } from "@/lib/rbac";

/** Fits the Prisma client just as well as a transaction client. */
type Db = Prisma.TransactionClient;

/**
 * Assigns a freshly created account to a workspace if its email domain is
 * claimed. No match means: nothing to do, the account stays without a
 * workspace for now (`/create-workspace`).
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
