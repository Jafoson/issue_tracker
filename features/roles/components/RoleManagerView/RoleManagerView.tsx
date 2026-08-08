"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { Input } from "@/components/ui/atoms/Input/Input";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import {
  createRole,
  deleteRole,
  setRoleGrants,
  updateRole,
} from "@/features/roles/actions";
import {
  cellId,
  PermissionMatrix,
} from "@/features/roles/components/PermissionMatrix/PermissionMatrix";
import { RoleCards } from "@/features/roles/components/RoleCards/RoleCards";
import { RoleEditor } from "@/features/roles/components/RoleEditor/RoleEditor";
import type {
  GrantChange,
  RoleView,
  RoleManagerView as View,
} from "@/features/roles/types";
import { useUnsavedChanges } from "@/lib/utils/useUnsavedChanges";
import styles from "./roleManagerView.module.scss";

interface Props {
  view: View;
  title: string;
  subtitle: string;
  /** Auf Seiten mit Umschalter steht der Titel schon auf dem Reiter. */
  showTitle?: boolean;
}

/**
 * Rollen eines Topfes anzeigen und bearbeiten.
 *
 * Dieselbe Komponente bedient alle drei Scopes — was sich unterscheidet, steht
 * im `target` und in den vom Server bereits ausgerechneten Grenzen
 * (`manageable`, `grantable`, `maxRank`). Die Oberfläche kennt weder
 * Rollennamen noch Rangregeln.
 *
 * Geteilte System-Rollen erscheinen mit, sind aber gesperrt: sie sind für alle
 * Mandanten dieselbe Zeile. Sichtbar bleiben sie, damit nachvollziehbar ist,
 * was etwa „Member" gewährt — und weil ein Vergleich mit ihnen der häufigste
 * Grund ist, überhaupt hier zu sein.
 *
 * Stammdaten einer Rolle (Name, Rang, Löschen) gehen sofort zum Server — es
 * sind einzelne Felder mit einzelnen Absichten. Die Matrix nicht: dort sammelt
 * `pending` die Klicks, bis jemand speichert. Wer eine Rolle umbaut, arbeitet
 * eine ganze Spalte durch, und aus derselben Erwägung heraus fährt ein
 * Wächter mit, der die Seite nicht ungefragt verlassen lässt.
 */
export function RoleManagerView({
  view,
  title,
  subtitle,
  showTitle = true,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Welche Spalten die Matrix gerade nicht zeigt. Bleibt im Browser: es ist
  // eine Frage des Blicks, nicht der Daten — zwei Leute vergleichen dieselben
  // Rollen nicht mit derselben Auswahl, und `router.refresh()` nach jedem
  // Klick in der Matrix würde eine gespeicherte Auswahl ohnehin nur einholen.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const toggleHidden = (roleId: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(roleId)) next.add(roleId);
      return next;
    });

  // Die noch nicht geschriebenen Klicks in der Matrix, je Zelle einer.
  const [draft, setDraft] = useState<ReadonlyMap<string, GrantChange>>(
    new Map(),
  );

  const roles = withDraft(view.roles, draft);

  /** Was der Server heute sagt — der Bezugspunkt für „geändert". */
  const saved = (roleId: string, permission: string) =>
    view.roles.find((role) => role.id === roleId)?.grants[permission] ?? null;

  const stage = (change: GrantChange) =>
    setDraft((current) => {
      const next = new Map(current);
      const id = cellId(change.roleId, change.permission);
      // Wer im Kreis herum wieder beim Ausgangswert landet, hat nichts geändert
      // — dann verschwindet die Zelle aus dem Stapel und mit ihr womöglich die
      // ganze Leiste.
      if (change.effect === saved(change.roleId, change.permission))
        next.delete(id);
      else next.set(id, change);
      return next;
    });

  // Jede Aktion gibt entweder `ok` oder einen Text zurück. Der Fehler landet
  // sichtbar über der Matrix statt still in der Konsole.
  const run = (action: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError("error" in result ? result.error : null);
      if (!("error" in result)) router.refresh();
    });

  const save = () => {
    if (draft.size === 0) return;
    run(async () => {
      const result = await setRoleGrants([...draft.values()]);
      // Erst nach dem Ja des Servers — und im selben Übergang wie das
      // `router.refresh()` in `run`. React zeigt beides zusammen, sonst stünde
      // für einen Wimpernschlag der alte Stand da, den man gerade überschrieben
      // hat. Bei einem Fehler bleibt der Stapel stehen: die Arbeit einer
      // Viertelstunde wirft man nicht wegen einer Fehlermeldung weg.
      if (!("error" in result)) setDraft(new Map());
      return result;
    });
  };

  // Der Wächter fragt, bevor die Seite verschwindet — ein Klick in der Matrix
  // sieht aus wie ein Schreibvorgang, und wer das glaubt, geht arglos weiter.
  useUnsavedChanges(draft.size > 0, () =>
    confirm({
      title: t("roles.leaveTitle"),
      description: t("roles.leaveDesc"),
      confirmLabel: t("roles.leaveConfirm"),
      cancelLabel: t("roles.leaveStay"),
      danger: true,
    }),
  );

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const result = await createRole(view.target, {
        name,
        desc: newDesc.trim(),
      });
      if (!("error" in result)) {
        setNewName("");
        setNewDesc("");
        setCreating(false);
      }
      return result;
    });
  };

  const editing = editingId
    ? (roles.find((role) => role.id === editingId) ?? null)
    : null;

  // Beide Felder tragen dieselbe Tastatur: Eingabe legt an, Escape bricht ab.
  const onCreateKey = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") submitNew();
    if (event.key === "Escape") setCreating(false);
  };

  // Die Trägerzahl auf den Karten zählt den Topf, in dem man gerade steht.
  // Welcher das ist, weiß nur diese Ebene — die Projektrollen des Workspace
  // gelten in allen seinen Projekten und werden deshalb auch über alle gezählt.
  const carriersHint =
    view.target.scope === "PLATFORM"
      ? t("roles.carriersOnPlatform")
      : view.target.scope === "PROJECT" && view.target.projectId
        ? t("roles.carriersInProject")
        : t("roles.carriersInWorkspace");

  const shown = roles.filter((role) => !hidden.has(role.id));
  // Gelöschte Rollen können in der Auswahl zurückbleiben; gezählt wird, was
  // wirklich noch ausgeblendet werden kann.
  const hiddenCount = roles.length - shown.length;

  return (
    <section className={styles.wrap}>
      <header className={styles.pageHeader}>
        <div className={styles.headText}>
          {/* Auf Seiten mit Umschalter steht der Titel schon auf dem Reiter. */}
          {showTitle && <h2 className={styles.pageTitle}>{title}</h2>}
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.headAction}>
          {/* Steht nur da, wenn es etwas zurückzuholen gibt — und auch für
              Leute ohne Rechte: ausblenden darf jeder, der zusieht. */}
          {hiddenCount > 0 && (
            <Button
              variant="text"
              icon={<Icon icon="lucide:eye" width={15} />}
              onClick={() => setHidden(new Set())}
            >
              {t("roles.showHidden", { count: hiddenCount })}
            </Button>
          )}

          {view.canManage && (
            <Button
              variant="primary"
              icon={<Icon icon="lucide:plus" width={15} />}
              onClick={() => setCreating((v) => !v)}
            >
              {t("roles.newRole")}
            </Button>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        {creating && (
          <div className={styles.createRow}>
            {/* Die Beschreibung gleich mit: sie steht später auf der Karte und
                ist das Einzige, was erklärt, wofür eine Rolle gedacht ist.
                Wer sie erst im Editor nachträgt, lässt sie meistens leer. */}
            <Input
              autoFocus
              size="sm"
              placeholder={t("roles.newRolePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={onCreateKey}
            />
            <Input
              size="sm"
              placeholder={t("roles.newRoleDescPlaceholder")}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={onCreateKey}
            />
            <Button variant="primary" onClick={submitNew} disabled={pending}>
              {t("actions.create")}
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              {t("actions.cancel")}
            </Button>
          </div>
        )}

        {roles.length === 0 ? (
          <EmptyState
            icon={<Icon icon="lucide:shield" width={32} />}
            title={t("roles.emptyTitle")}
            description={t("roles.emptyDesc")}
          />
        ) : (
          <>
            <RoleCards
              roles={roles}
              total={view.permissions.length}
              carriersHint={carriersHint}
              hidden={hidden}
              editingId={editingId}
              onToggle={toggleHidden}
              onEdit={setEditingId}
            />

            {editing && (
              <RoleEditor
                key={editing.id}
                role={editing}
                maxRank={view.maxRank}
                pending={pending}
                onUpdate={(patch) => run(() => updateRole(editing.id, patch))}
                onDelete={() =>
                  run(async () => {
                    const result = await deleteRole(editing.id);
                    if (!("error" in result)) {
                      setEditingId(null);
                      // Mit der Rolle geht auch, was für sie offen war — sonst
                      // hinge die Leiste an einer Spalte, die es nicht mehr
                      // gibt, und das Speichern liefe in einen Fehler.
                      setDraft(withoutRole(editing.id));
                    }
                    return result;
                  })
                }
                onClose={() => setEditingId(null)}
              />
            )}

            <PermissionMatrix
              roles={shown}
              permissions={view.permissions}
              grantable={view.grantable}
              changed={new Set(draft.keys())}
              saving={pending}
              onChange={stage}
              onSave={save}
              onDiscard={() => setDraft(new Map())}
            />
          </>
        )}
      </div>
    </section>
  );
}

/** Nimmt alles aus dem Stapel, was zu einer Rolle gehört. */
const withoutRole =
  (roleId: string) => (current: ReadonlyMap<string, GrantChange>) =>
    new Map(
      [...current].filter(([, change]) => change.roleId !== roleId),
    ) as ReadonlyMap<string, GrantChange>;

/**
 * Legt die noch nicht gespeicherten Klicks über den Stand des Servers.
 *
 * Die Matrix bekommt dadurch nur eine Liste von Rollen zu sehen und muss nicht
 * wissen, welcher Wert woher stammt — welche Zelle offen ist, sagt ihr `changed`.
 */
function withDraft(
  roles: RoleView[],
  draft: ReadonlyMap<string, GrantChange>,
): RoleView[] {
  if (draft.size === 0) return roles;

  const byRole = new Map<string, GrantChange[]>();
  for (const change of draft.values()) {
    const list = byRole.get(change.roleId);
    if (list) list.push(change);
    else byRole.set(change.roleId, [change]);
  }

  return roles.map((role) => {
    const changes = byRole.get(role.id);
    if (!changes) return role;

    const grants = { ...role.grants };
    for (const change of changes) {
      if (change.effect === null) delete grants[change.permission];
      else grants[change.permission] = change.effect;
    }
    return { ...role, grants };
  });
}
