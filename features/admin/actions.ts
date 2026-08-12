"use server";

import { revalidatePath } from "next/cache";
import { recordAudit, recordAuditIn } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  assignmentCeiling,
  currentUserId,
  getAccess,
  PLATFORM,
} from "@/lib/permissions";
import { PROJECT_ADMIN_ROLE_KEY, systemRoleId } from "@/lib/rbac";

// ─── Was die Plattformverwaltung tun darf ─────────────────────────────────────
//
// Vier Eingriffe, und drei Regeln ziehen sich durch alle:
//
//   1. **Niemand fasst sich selbst an.** Die eigene Rolle zu setzen wäre
//      Selbstbeförderung, sich selbst stillzulegen wäre ein Weg, die letzte
//      Verwaltung der Plattform aus Versehen zu schließen.
//   2. **Niemand vergibt eine Rolle über dem eigenen Rang** — dieselbe Regel wie
//      in `features/roles/actions.ts`, eine Ebene höher.
//   3. **Jeder Eingriff steht danach im Protokoll.** Beim Notfall-Zugriff nicht
//      nebenher, sondern in derselben Transaktion: ohne Eintrag keine
//      Mitgliedschaft.
//
// Der Notfall-Zugriff ist die einzige Stelle im ganzen Plattform-Bereich, die
// den Weg zu Inhalten öffnet. Er tut es offen: er legt eine gewöhnliche
// Mitgliedschaft an, die im Projekt für alle sichtbar ist, verlangt eine
// Begründung und schreibt beides fest. Ein stiller Durchgriff, der Inhalte zeigt
// ohne Spur zu hinterlassen, existiert hier nicht — dafür gibt es allein
// `tenant.access` in der Support-Rolle, und die trägt kein Administrator.

type AdminResult = { ok: true } | { error: string };

const NOT_LOGGED_IN = "You must be logged in.";
const NOT_ALLOWED = "You are not allowed to do this.";

/** Kürzeste Begründung, die als Begründung durchgeht. */
const MIN_REASON = 10;

async function revalidate() {
  revalidatePath("/", "layout");
}

function displayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

// ─── Konten ───────────────────────────────────────────────────────────────────

/**
 * Die Plattform-Rolle eines Kontos setzen.
 *
 * Das ist die Antwort auf „wer hat wem Administrator-Rechte gegeben?" — und
 * genau deshalb steht sie hinterher im Protokoll, mit alter und neuer Rolle.
 */
export async function setPlatformRole(
  userId: string,
  roleId: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("user.manage")) return { error: NOT_ALLOWED };

  // Regel 1. Wer sich selbst befördern könnte, bräuchte die Rangordnung nicht.
  if (userId === actorId)
    return { error: "You cannot change your own platform role." };

  const [target, role] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        platformRole: { select: { key: true, name: true, rank: true } },
      },
    }),
    db.role.findUnique({
      where: { id: roleId },
      select: { key: true, name: true, rank: true, scope: true },
    }),
  ]);

  if (!target) return { error: "This account no longer exists." };
  if (!role || role.scope !== "PLATFORM")
    return { error: "This is not a platform role." };

  // Regel 2, in beide Richtungen: weder eine höhere Rolle vergeben, noch jemanden
  // anfassen, der schon höher steht als man selbst.
  const ceiling = assignmentCeiling(access, "PLATFORM");
  if (role.rank > ceiling)
    return { error: "You cannot assign a role above your own." };
  if ((target.platformRole?.rank ?? -1) > ceiling)
    return { error: "You cannot change a role above your own." };

  await db.user.update({
    where: { id: userId },
    data: { platformRoleId: roleId },
  });

  await recordAudit({
    action: "user.role.platform",
    actorId,
    target: { type: "user", id: userId, label: displayName(target) },
    meta: {
      from: target.platformRole?.key ?? null,
      to: role.key,
    },
  });

  await revalidate();
  return { ok: true };
}

/**
 * Ein Konto stilllegen oder wieder freigeben.
 *
 * Stilllegen statt löschen: ein gelöschtes Konto nähme seine Issues, Kommentare
 * und Zuweisungen mit oder ließe sie ohne Urheber zurück. Ein stillgelegtes
 * bleibt sichtbar, wo es gearbeitet hat, kommt aber nicht mehr herein
 * (`auth.ts`) und bekommt nirgends mehr Rechte (`lib/permissions.ts`).
 */
export async function setUserActive(
  userId: string,
  active: boolean,
  reason?: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("user.manage")) return { error: NOT_ALLOWED };

  if (userId === actorId)
    return { error: "You cannot deactivate your own account." };

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      platformRole: { select: { rank: true } },
    },
  });
  if (!target) return { error: "This account no longer exists." };

  if ((target.platformRole?.rank ?? -1) > assignmentCeiling(access, "PLATFORM"))
    return { error: "You cannot change an account above your own role." };

  await db.user.update({
    where: { id: userId },
    data: { deactivatedAt: active ? null : new Date() },
  });

  await recordAudit({
    action: active ? "user.reactivated" : "user.deactivated",
    actorId,
    target: { type: "user", id: userId, label: displayName(target) },
    reason,
  });

  await revalidate();
  return { ok: true };
}

// ─── Projekt-Stammdaten ───────────────────────────────────────────────────────

/**
 * Ein verwaistes Projekt neu zuordnen.
 *
 * Ein Projekt wird zum Waisen, wenn das Konto seines Erstellers gelöscht wird —
 * dann steht es da und niemand ist zuständig. Diese Aktion setzt den Besitzer
 * neu und **nimmt ihn zugleich ins Projekt auf**, denn ein Besitzer ohne
 * Mitgliedschaft wäre nur ein Name in einer Tabelle: Zugriff entsteht in diesem
 * System allein aus `ProjectMember`.
 *
 * Sie ist damit ein offener Weg in ein fremdes Projekt und wird wie der
 * Notfall-Zugriff behandelt: in einer Transaktion, mit Protokoll.
 */
export async function reassignProject(
  projectId: string,
  newOwnerId: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("project.metadata.manage")) return { error: NOT_ALLOWED };

  const [project, owner] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        workspaceId: true,
        createdBy: { select: { id: true } },
      },
    }),
    db.user.findUnique({
      where: { id: newOwnerId },
      select: { firstName: true, lastName: true, deactivatedAt: true },
    }),
  ]);

  if (!project) return { error: "This project no longer exists." };
  if (!owner) return { error: "This account no longer exists." };
  if (owner.deactivatedAt)
    return { error: "A deactivated account cannot own a project." };

  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: { createdById: newOwnerId },
    });

    // Aufnehmen, ohne eine bestehende Rolle zu überschreiben: wer schon drin ist,
    // behält, was er hatte.
    await tx.projectMember.createMany({
      data: [
        {
          projectId,
          userId: newOwnerId,
          roleId: systemRoleId("PROJECT", PROJECT_ADMIN_ROLE_KEY),
        },
      ],
      skipDuplicates: true,
    });

    await recordAuditIn(tx, {
      action: "project.owner.changed",
      actorId,
      target: { type: "project", id: projectId, label: project.name },
      workspaceId: project.workspaceId,
      projectId,
      meta: { from: project.createdBy?.id ?? null, to: newOwnerId },
    });
  });

  await revalidate();
  return { ok: true };
}

/** Ein Projekt stilllegen oder wieder in Betrieb nehmen. */
export async function setProjectArchived(
  projectId: string,
  archived: boolean,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("project.metadata.manage")) return { error: NOT_ALLOWED };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { name: true, workspaceId: true },
  });
  if (!project) return { error: "This project no longer exists." };

  await db.project.update({
    where: { id: projectId },
    data: { archivedAt: archived ? new Date() : null },
  });

  await recordAudit({
    action: archived ? "project.archived" : "project.unarchived",
    actorId,
    target: { type: "project", id: projectId, label: project.name },
    workspaceId: project.workspaceId,
    projectId,
  });

  await revalidate();
  return { ok: true };
}

// ─── Notfall-Zugriff ──────────────────────────────────────────────────────────

/**
 * Sich selbst in ein fremdes Projekt eintragen — der Ausnahmefall.
 *
 * Gedacht für den Tag, an dem die Projektleitung im Krankenhaus liegt und etwas
 * dringend geändert werden muss. Drei Dinge machen ihn zur Ausnahme und nicht
 * zum bequemen Weg:
 *
 *   - Es braucht eine **Begründung**, und zwar eine geschriebene. Sie steht
 *     danach im Protokoll neben dem Namen dessen, der sie geschrieben hat.
 *   - Der Eintrag entsteht **in derselben Transaktion** wie die Mitgliedschaft.
 *     Es gibt keinen Zustand, in dem jemand drin ist und das Protokoll schweigt.
 *   - Die Mitgliedschaft ist **sichtbar**. Sie steht in der Mitgliederliste des
 *     Projekts wie jede andere; wer dort arbeitet, sieht am nächsten Morgen, wer
 *     dazugekommen ist.
 *
 * Wer schon Mitglied ist, braucht ihn nicht — dann ist es kein Notfall-Zugriff,
 * sondern der normale Weg, und die Aktion sagt das.
 */
export async function breakGlassJoinProject(data: {
  projectId: string;
  reason: string;
}): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("project.breakglass")) return { error: NOT_ALLOWED };

  const reason = data.reason.trim();
  if (reason.length < MIN_REASON)
    return {
      error: `Please state why this access is needed (at least ${MIN_REASON} characters).`,
    };

  const project = await db.project.findUnique({
    where: { id: data.projectId },
    select: { name: true, workspaceId: true },
  });
  if (!project) return { error: "This project no longer exists." };

  const existing = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: data.projectId, userId: actorId } },
    select: { userId: true },
  });
  if (existing) return { error: "You are already a member of this project." };

  await db.$transaction(async (tx) => {
    await tx.projectMember.create({
      data: {
        projectId: data.projectId,
        userId: actorId,
        roleId: systemRoleId("PROJECT", PROJECT_ADMIN_ROLE_KEY),
      },
    });

    await recordAuditIn(tx, {
      action: "project.breakglass",
      actorId,
      target: { type: "project", id: data.projectId, label: project.name },
      workspaceId: project.workspaceId,
      projectId: data.projectId,
      reason,
    });
  });

  await revalidate();
  return { ok: true };
}

// ─── Workspaces ───────────────────────────────────────────────────────────────
//
// Zwei Eingriffe, und zwischen ihnen liegt eine Absicht: **sperren ist der
// Normalfall, löschen die Ausnahme.**
//
// Sperren nimmt den Zugang und lässt die Daten stehen. Es wirkt sofort und für
// alle — `lib/permissions.ts` gibt in einem gesperrten Workspace niemandem mehr
// Rechte, auch seiner Leitung nicht — und es lässt sich am nächsten Tag
// zurücknehmen. Das ist die richtige Antwort auf eine offene Rechnung, einen
// Missbrauchsverdacht, ein auslaufendes Vertragsverhältnis.
//
// Löschen nimmt alles: Projekte, Aufgaben, Kommentare, Mitgliedschaften, Rollen.
// Es gibt keinen Weg zurück. Deshalb hängt es an einer Vorbedingung, die diese
// Aktion nicht selbst erfindet, sondern verlangt: **ein Workspace lässt sich nur
// löschen, wenn er schon gesperrt ist.** Wer löschen will, muss also erst
// sperren — und zwischen beiden Schritten liegt eine Nacht, ein zweiter Blick,
// die Möglichkeit, dass sich jemand meldet. Diese Reihenfolge ist der eigentliche
// Schutz; der Tippzwang im Dialog ist nur die Erinnerung daran.

/**
 * Einen Workspace sperren oder wieder freigeben.
 *
 * Die Sperre ist keine Anzeige, sondern eine Wirkung: `loadBase` in
 * `lib/permissions.ts` liest `suspended` **vor** jeder Rollenauflösung und gibt
 * danach nichts mehr heraus. Ein gesperrter Mandant ist für alle zu, die darin
 * arbeiten — der Support kommt über `tenant.access` weiterhin hinein, denn
 * gerade dann muss jemand nachsehen können.
 */
export async function setWorkspaceSuspended(
  workspaceId: string,
  suspended: boolean,
  reason?: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("workspace.suspend")) return { error: NOT_ALLOWED };

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, _count: { select: { members: true } } },
  });
  if (!workspace) return { error: "This workspace no longer exists." };

  await db.workspace.update({
    where: { id: workspaceId },
    data: { suspended },
  });

  await recordAudit({
    action: suspended ? "workspace.suspended" : "workspace.unsuspended",
    actorId,
    target: { type: "workspace", id: workspaceId, label: workspace.name },
    workspaceId,
    reason,
    // Wie viele Menschen das betrifft, gehört in die Zeile: „gesperrt" liest
    // sich anders, wenn dahinter vierzig Konten stehen.
    meta: { members: workspace._count.members },
  });

  await revalidate();
  return { ok: true };
}

/**
 * Einen Workspace mit allem, was darin liegt, löschen — von der Plattform aus.
 *
 * Es gibt diese Aktion **zusätzlich** zu `deleteWorkspace` in
 * `features/workspaces/actions.ts`, und der Unterschied ist keine Doppelung,
 * sondern der Kontext der Prüfung. `workspace.delete` darf in beiden Scopes
 * stehen und bedeutet dort Verschiedenes:
 *
 *   in einer Workspace-Rolle  → „ich darf **diesen** Workspace löschen" (Owner)
 *   in einer Plattform-Rolle  → „ich darf Mandanten löschen" (Betreiber)
 *
 * Der Weg über den Workspace-Kontext greift für einen Plattform-Admin nicht: er
 * ist dort kein Mitglied, und die Auflösung sammelt nur aus der Workspace-Rolle.
 * Deshalb prüft diese Aktion im Plattform-Kontext.
 *
 * Die Vorbedingung — erst sperren, dann löschen — steht bewusst im Server und
 * nicht nur im Dialog: eine Bestätigung im Browser ist eine Bitte, keine Regel.
 */
export async function deleteWorkspaceAsPlatform(
  workspaceId: string,
  confirmation: string,
): Promise<AdminResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: NOT_LOGGED_IN };

  const access = await getAccess(PLATFORM);
  if (!access.has("workspace.delete")) return { error: NOT_ALLOWED };

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      suspended: true,
      _count: { select: { members: true, projects: true } },
    },
  });
  if (!workspace) return { error: "This workspace no longer exists." };

  if (!workspace.suspended) {
    return {
      error: "Suspend this workspace before deleting it.",
    };
  }

  // Der getippte Name. Nicht als Schikane, sondern damit die Zeile, auf der man
  // gerade steht, nicht die Zeile ist, die man löscht.
  if (confirmation.trim() !== workspace.name) {
    return { error: "The name does not match." };
  }

  const issues = await db.issue.count({ where: { project: { workspaceId } } });

  await db.$transaction(async (tx) => {
    // Die Aufgaben zuerst: ihr Fremdschlüssel auf das Projekt steht auf
    // `Restrict`, die Projekte ließen sich sonst gar nicht löschen. Alles
    // Übrige kaskadiert vom Workspace aus.
    await tx.issue.deleteMany({ where: { project: { workspaceId } } });
    await tx.workspace.delete({ where: { id: workspaceId } });
  });

  await recordAudit({
    action: "workspace.deleted",
    actorId,
    target: { type: "workspace", id: workspaceId, label: workspace.name },
    workspaceId,
    meta: {
      members: workspace._count.members,
      projects: workspace._count.projects,
      issues,
      from: "platform",
    },
  });

  await revalidate();
  return { ok: true };
}
