"use server";

import { revalidatePath } from "next/cache";
import { PROJECT_VIEWS } from "@/features/dashboard/view";
import { isWidgetKey } from "@/features/dashboard/widgets";
import { RANGES, type RangeKey } from "@/lib/buckets";
import { db } from "@/lib/db";
import { currentUserCanEnterWorkspace, hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";

// Wie die eigenen Einstellungen (`features/account/actions.ts`) kennen diese
// Aktionen nur eine Frage nach der Person: wer ist eingeloggt? Es gibt keinen
// Parameter „welcher Benutzer" — geschrieben wird immer in die eigene Zeile.
//
// Das Projekt dagegen kommt von außen herein und wird deshalb geprüft. Nicht,
// weil in der Zeile etwas Schützenswertes stünde — es ist eine Anordnung von
// Kacheln —, sondern weil ohne Prüfung jeder Eingeloggte Zeilen zu beliebigen
// Projekt-Ids anlegen könnte. Dieselbe Erlaubnis wie zum Lesen des Dashboards.

type Result = { ok: true } | { error: string };

const NOT_ALLOWED = "You cannot change this dashboard.";

/**
 * Schreibt in die eigene Zeile und legt sie an, falls es noch keine gibt.
 *
 * `upsert` statt `update`, weil die Zeile erst mit der ersten Änderung entsteht:
 * wer nie etwas verstellt, hat keine, und das ist der Normalfall.
 */
async function write(
  projectId: string,
  data: { hidden?: string[]; order?: string[]; range?: string; view?: string },
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };
  if (!(await hasPermission("project.view", { projectId }))) {
    return { error: NOT_ALLOWED };
  }

  await db.dashboardPreference.upsert({
    where: { userId_projectId: { userId: session.userId, projectId } },
    create: { userId: session.userId, projectId, ...data },
    update: data,
  });

  // Wie überall in diesem Projekt: der Baum ab der Wurzel. Die Seite selbst
  // gezielt zu benennen ginge, hieße aber, ihren Routen-Pfad samt Gruppe und
  // Platzhaltern hier ein zweites Mal zu führen — und der bricht still, sobald
  // die Route umzieht.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Die Anordnung sichern: was steht wo, und was ist abgewählt.
 *
 * Beides in einem Aufruf, weil es eine Handlung ist — der Dialog schließt mit
 * einem Stand, nicht mit zwei. Was hereinkommt, wird gegen die Registry
 * gefiltert: ein unbekannter Schlüssel ist kein Fehler, den man dem Aufrufer
 * meldet, sondern einer, den man nicht speichert.
 */
export async function saveDashboardLayout(
  projectId: string,
  order: string[],
  hidden: string[],
): Promise<Result> {
  return write(projectId, {
    order: order.filter(isWidgetKey),
    hidden: hidden.filter(isWidgetKey),
  });
}

/** Der Zeitraum, mit dem dieses Dashboard künftig aufgeht. */
export async function setDashboardRange(
  projectId: string,
  range: string,
): Promise<Result> {
  if (!(RANGES as readonly string[]).includes(range)) {
    return { error: `Unknown range: ${range}` };
  }
  return write(projectId, { range: range as RangeKey });
}

/**
 * Die Ansicht, in der diese Projektseite künftig aufgeht.
 *
 * Wird bei jedem Umschalten mitgeschrieben, damit die Projektzeile in der
 * Seitenleiste dorthin zurückführt, wo man zuletzt war. Anders als bei der
 * Anordnung gibt es dafür kein „Speichern": es ist eine Beobachtung, keine
 * Einstellung.
 */
export async function setDashboardView(
  projectId: string,
  view: string,
): Promise<Result> {
  if (!(PROJECT_VIEWS as readonly string[]).includes(view)) {
    return { error: `Unknown view: ${view}` };
  }
  return write(projectId, { view });
}

/**
 * Zurück auf die Vorgabe — die Zeile verschwindet.
 *
 * Löschen und nicht „alle Vorgabewerte hineinschreiben": eine Zeile, die genau
 * die Vorgabe enthält, friert sie ein. Wer später einen Baustein ergänzt, hätte
 * ihn bei allen, die je zurückgesetzt haben, an einer festgeschriebenen Stelle —
 * oder gar nicht.
 */
export async function resetDashboardLayout(projectId: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };

  await db.dashboardPreference.deleteMany({
    where: { userId: session.userId, projectId },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── Dasselbe eine Ebene höher: das Dashboard eines Workspace ────────────────
//
// Derselbe Aufbau wie oben — `write`, drei Aktionen, dieselbe Prüfung des
// Zutritts. Kein `setDashboardView`-Gegenstück: Dashboard und Übersicht sind
// beim Workspace zwei eigene Routen, keine gespeicherte Ansicht.

async function writeWorkspace(
  workspaceId: string,
  data: { hidden?: string[]; order?: string[]; range?: string },
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };
  if (!(await currentUserCanEnterWorkspace(workspaceId))) {
    return { error: NOT_ALLOWED };
  }

  await db.workspaceDashboardPreference.upsert({
    where: { userId_workspaceId: { userId: session.userId, workspaceId } },
    create: { userId: session.userId, workspaceId, ...data },
    update: data,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveWorkspaceDashboardLayout(
  workspaceId: string,
  order: string[],
  hidden: string[],
): Promise<Result> {
  return writeWorkspace(workspaceId, {
    order: order.filter(isWidgetKey),
    hidden: hidden.filter(isWidgetKey),
  });
}

export async function setWorkspaceDashboardRange(
  workspaceId: string,
  range: string,
): Promise<Result> {
  if (!(RANGES as readonly string[]).includes(range)) {
    return { error: `Unknown range: ${range}` };
  }
  return writeWorkspace(workspaceId, { range: range as RangeKey });
}

export async function resetWorkspaceDashboardLayout(
  workspaceId: string,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };

  await db.workspaceDashboardPreference.deleteMany({
    where: { userId: session.userId, workspaceId },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
