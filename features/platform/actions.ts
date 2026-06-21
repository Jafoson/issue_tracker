"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PermissionError } from "@/lib/permissions";
import { requirePlatformAdmin } from "@/lib/platform";

// Plattform-Operationen. Jede Action verlangt zuerst Plattform-Admin-Rechte —
// fail-safe. Sie wirken auf der Tenant-Ebene (Workspace), nicht in Workspace-Inhalten.

async function revalidateAdmin() {
  revalidatePath("/", "layout");
}

/** Workspace (Tenant) unwiderruflich löschen. Cascade entfernt alle Inhalte. */
export async function deleteWorkspaceAsAdmin(workspaceId: string) {
  await requirePlatformAdmin();
  await db.workspace.delete({ where: { id: workspaceId } });
  await revalidateAdmin();
}

/** Workspace sperren/entsperren — deaktiviert den Zugriff, ohne zu löschen. */
export async function setWorkspaceSuspended(
  workspaceId: string,
  suspended: boolean,
) {
  await requirePlatformAdmin();
  await db.workspace.update({
    where: { id: workspaceId },
    data: { suspended },
  });
  await revalidateAdmin();
}

/**
 * Einen User zum Plattform-Admin ernennen oder das Recht entziehen.
 * Der letzte verbleibende Plattform-Admin kann sich nicht selbst entziehen
 * (verhindert Aussperren aus der Plattform-Verwaltung).
 */
export async function setUserPlatformAdmin(userId: string, value: boolean) {
  await requirePlatformAdmin();

  if (!value) {
    const adminCount = await db.user.count({
      where: { isPlatformAdmin: true },
    });
    if (adminCount <= 1) {
      throw new PermissionError("platform.admin.last");
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { isPlatformAdmin: value },
  });
  await revalidateAdmin();
}

/** FormData-Wrapper für das Grant-Formular (Select im Admin-Panel). */
export async function grantPlatformAdmin(formData: FormData) {
  const userId = (formData.get("userId") as string | null)?.trim();
  if (!userId) return;
  await setUserPlatformAdmin(userId, true);
}
