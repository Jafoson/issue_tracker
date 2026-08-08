"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import type { GrantChange, RoleView } from "@/features/roles/types";
import { type PermissionEffect, roleColor } from "@/lib/rbac";
import styles from "./permissionMatrix.module.scss";

/** Adresse einer Zelle — dieselbe Bildung nutzt der Aufrufer für `changed`. */
export const cellId = (roleId: string, permission: string) =>
  `${roleId}|${permission}`;

interface Props {
  /** Spalten. Reihenfolge wie hereingegeben (Rang absteigend), ohne die
   *  ausgeblendeten — die Matrix kennt nur, was sie zeigen soll. Die noch
   *  offenen Änderungen sind darin bereits verrechnet. */
  roles: RoleView[];
  /** Zeilen — die Permissions, die in diesem Scope vergeben werden dürfen. */
  permissions: { key: string; desc: string }[];
  /** Permissions, die der Handelnde per ALLOW weitergeben darf. */
  grantable: string[];
  /**
   * Zellen, die vom Stand des Servers abweichen (`cellId`) — auch die gerade
   * ausgeblendeten: die Leiste zählt alles, was beim Speichern mitginge.
   */
  changed: ReadonlySet<string>;
  /** Der Stapel geht gerade zum Server. */
  saving: boolean;
  onChange: (change: GrantChange) => void;
  onSave: () => void;
  onDiscard: () => void;
}

/**
 * Eine Tabelle statt einer Liste je Rolle: Zeilen sind Permissions, Spalten
 * sind Rollen.
 *
 * Der Vergleich ist der eigentliche Zweck dieser Seite — „darf der Viewer das,
 * was der Contributor darf?" beantwortet eine Zeile, nicht das Aufklappen zweier
 * Karten nacheinander. Deshalb bleiben Kopfzeile und erste Spalte beim Scrollen
 * stehen; ohne beides verliert eine Matrix ihren Nutzen.
 *
 * Ein Eintrag hat drei Zustände: nicht gesetzt, erlaubt, verboten. Das Verbot
 * ist eine eigene Wahl und nicht bloß die Abwesenheit einer Erlaubnis — weil
 * sich die Scopes vereinigen, nimmt „nicht gesetzt" nichts weg, was ein anderer
 * Scope bereits gewährt. Nur DENY tut das. Ein Klick geht deshalb im Kreis
 * (nicht gesetzt → erlaubt → verboten), Umschalt+Klick setzt direkt zurück.
 *
 * Geschrieben wird erst auf Knopfdruck. Ein Klick auf eine Zelle ist selten
 * allein gemeint: wer eine Rolle umbaut, geht eine Spalte entlang und trifft
 * dabei auch daneben. Als je eigener Schreibvorgang wäre jeder Fehlgriff sofort
 * geltendes Recht — gesammelt bleibt er bis zum Speichern eine Absicht, die man
 * zurücknehmen kann.
 */
export function PermissionMatrix({
  roles,
  permissions,
  grantable,
  changed,
  saving,
  onChange,
  onSave,
  onDiscard,
}: Props) {
  const t = useTranslations();
  const [query, setQuery] = useState("");

  const canGrant = new Set(grantable);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? permissions.filter(
        (p) =>
          p.key.toLowerCase().includes(needle) ||
          p.desc.toLowerCase().includes(needle),
      )
    : permissions;

  const groups = groupPermissions(visible);

  return (
    <div className={styles.matrix}>
      <div className={styles.toolbar}>
        {/* Die Breite trägt die Hülle, nicht das Feld: `Input` reicht sein
            `className` an das `<input>` durch, und dessen Rahmen zeichnet eine
            Ebene darüber — dort gesetzt bliebe der Kasten trotzdem so breit wie
            die Leiste. */}
        <div className={styles.search}>
          <Input
            variant="search"
            size="sm"
            placeholder={t("roles.searchPermissions")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("roles.searchPermissions")}
          />
        </div>

        {/* Die Bedienung steht vor der Tabelle, nicht hinter ihr: wer zum ersten
            Mal auf ein Kästchen zielt, hat den Satz dann schon gelesen — unter
            einer Tabelle, die selbst scrollt, stand er faktisch nie im Bild. */}
        <p className={styles.hint}>{t("roles.cycleHint")}</p>

        <ul className={styles.legend}>
          <li>
            <span className={styles.swatch} data-effect="ALLOW">
              <Icon icon="lucide:check" width={11} />
            </span>
            {t("roles.allowed")}
          </li>
          <li>
            <span className={styles.swatch} data-effect="DENY">
              <Icon icon="lucide:ban" width={11} />
            </span>
            {t("roles.denied")}
          </li>
          <li>
            <span className={styles.swatch} data-effect="unset" />
            {t("roles.effectUnset")}
          </li>
        </ul>
      </div>

      <div className={styles.card}>
        {roles.length === 0 ? (
          <p className={styles.noMatch}>{t("roles.allHidden")}</p>
        ) : visible.length === 0 ? (
          <p className={styles.noMatch}>{t("roles.noMatchingPermissions")}</p>
        ) : (
          <div className={styles.scroller}>
            <table
              className={styles.table}
              style={{ "--role-cols": roles.length } as React.CSSProperties}
            >
              <colgroup>
                <col className={styles.colPerm} />
                {roles.map((role) => (
                  <col key={role.id} className={styles.colRole} />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th scope="col" className={styles.corner}>
                    {t("roles.permission")}
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.id}
                      scope="col"
                      className={styles.roleHead}
                      title={role.name}
                    >
                      <span className={styles.roleHeadInner}>
                        <span
                          className={styles.roleDot}
                          style={{ background: roleColor(role.rank) }}
                        />
                        <span className={styles.roleName}>{role.name}</span>
                        {!role.manageable && (
                          <Icon
                            icon="lucide:lock"
                            width={11}
                            className={styles.lock}
                            aria-label={
                              role.system
                                ? t("roles.sharedLocked")
                                : t("roles.locked")
                            }
                          />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.id}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={roles.length + 1}
                        className={styles.groupHead}
                      >
                        <span className={styles.groupHeadText}>
                          {group.known
                            ? t(`roles.group.${group.known}`)
                            : group.fallback}
                        </span>
                      </th>
                    </tr>

                    {group.permissions.map((permission) => (
                      <tr key={permission.key} className={styles.row}>
                        <th scope="row" className={styles.permHead}>
                          <span className={styles.permDesc}>
                            {permission.desc}
                          </span>
                          <code className={styles.permKey}>
                            {permission.key}
                          </code>
                        </th>

                        {roles.map((role) => (
                          <Cell
                            key={role.id}
                            role={role}
                            permission={permission}
                            effect={role.grants[permission.key] ?? null}
                            allowLocked={!canGrant.has(permission.key)}
                            changed={changed.has(
                              cellId(role.id, permission.key),
                            )}
                            saving={saving}
                            onChange={onChange}
                          />
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Erscheint mit der ersten Änderung und bleibt unter der Tabelle stehen —
          die Tabelle scrollt in sich, die Leiste ist deshalb immer im Bild.
          `output` ist von sich aus eine Statusmeldung (`aria-live="polite"`):
          das Auftauchen und jede neue Zahl werden angesagt, ohne dass der Fokus
          aus der Matrix gezogen wird. */}
      {changed.size > 0 && (
        <output className={styles.pending}>
          <Icon
            icon="lucide:pencil-line"
            width={15}
            className={styles.pendingIcon}
          />
          <span className={styles.pendingText}>
            {t("roles.unsavedCount", { count: changed.size })}
          </span>

          <Button variant="text" onClick={onDiscard} disabled={saving}>
            {t("actions.discard")}
          </Button>
          <Button
            variant="primary"
            icon={<Icon icon="lucide:check" width={15} />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? t("actions.saving") : t("actions.save")}
          </Button>
        </output>
      )}
    </div>
  );
}

// ─── Zelle ────────────────────────────────────────────────────────────────────

function Cell({
  role,
  permission,
  effect,
  allowLocked,
  changed,
  saving,
  onChange,
}: {
  role: RoleView;
  permission: { key: string; desc: string };
  effect: PermissionEffect | null;
  allowLocked: boolean;
  /** Weicht vom Stand des Servers ab und ginge beim Speichern mit. */
  changed: boolean;
  saving: boolean;
  onChange: (change: GrantChange) => void;
}) {
  const t = useTranslations();

  const state =
    effect === "ALLOW"
      ? t("roles.allowed")
      : effect === "DENY"
        ? t("roles.denied")
        : t("roles.effectUnset");

  // Zeile und Spalte stehen im Tabellenkopf; vorgelesen wird beides ohnehin.
  // Der Name hier nennt sie trotzdem mit, weil der Knopf auch einzeln
  // angesteuert wird.
  const name = `${permission.desc} — ${role.name}: ${state}`;

  if (!role.manageable) {
    return (
      <td className={styles.cell} data-effect={effect ?? "unset"} data-locked>
        <span
          className={styles.mark}
          title={role.system ? t("roles.sharedLocked") : t("roles.locked")}
        >
          <StateIcon effect={effect} />
          <span className={styles.srOnly}>{name}</span>
        </span>
      </td>
    );
  }

  // Wer eine Erlaubnis selbst nicht hat, kann sie nicht weitergeben — die
  // Stufe wird dann übersprungen, verbieten bleibt möglich.
  const next = (reset: boolean): PermissionEffect | null => {
    if (reset) return null;
    if (effect === null) return allowLocked ? "DENY" : "ALLOW";
    if (effect === "ALLOW") return "DENY";
    return null;
  };

  return (
    <td
      className={styles.cell}
      data-effect={effect ?? "unset"}
      data-changed={changed || undefined}
    >
      <button
        type="button"
        className={styles.mark}
        aria-label={changed ? `${name} — ${t("roles.unsaved")}` : name}
        title={
          allowLocked && effect !== "DENY" ? t("roles.allowLocked") : state
        }
        disabled={saving}
        onClick={(event) => {
          const effectNext = next(event.shiftKey);
          if (effectNext === effect) return;
          onChange({
            roleId: role.id,
            permission: permission.key,
            effect: effectNext,
          });
        }}
      >
        <StateIcon effect={effect} />
      </button>
    </td>
  );
}

function StateIcon({ effect }: { effect: PermissionEffect | null }) {
  if (effect === "ALLOW") return <Icon icon="lucide:check" width={13} />;
  if (effect === "DENY") return <Icon icon="lucide:ban" width={13} />;
  return null;
}

// ─── Gruppierung ──────────────────────────────────────────────────────────────

/**
 * Der erste Namensteil eines Keys nennt das Objekt, um das es geht. Ein paar
 * davon tragen nur eine einzige Permission (`user.manage`, `audit.view`) und
 * bekommen deshalb keine eigene Überschrift, sondern gehören zum nächstgrößeren
 * Thema.
 */
const GROUP_OF: Record<string, string> = {
  issue: "issue",
  comment: "comment",
  label: "label",
  project: "project",
  member: "member",
  team: "team",
  role: "role",
  workspace: "workspace",
  config: "workspace",
  audit: "workspace",
  platform: "platform",
  user: "platform",
  tenant: "platform",
};

/** Reihenfolge der Abschnitte: das Alltägliche zuerst, die Verwaltung zuletzt. */
const GROUP_ORDER = {
  issue: 0,
  comment: 1,
  label: 2,
  project: 3,
  member: 4,
  team: 5,
  role: 6,
  workspace: 7,
  platform: 8,
} as const;

type GroupId = keyof typeof GROUP_ORDER;

const isGroupId = (value: string): value is GroupId => value in GROUP_ORDER;

interface Group {
  id: string;
  /** Gesetzt, wenn es für den Abschnitt eine Übersetzung gibt. */
  known: GroupId | null;
  /** Notname für ein künftiges Objekt, das hier noch nicht bekannt ist. */
  fallback: string;
  permissions: { key: string; desc: string }[];
}

function groupPermissions(permissions: { key: string; desc: string }[]) {
  const byGroup = new Map<string, Group>();

  for (const permission of permissions) {
    const object = permission.key.split(".")[0];
    const id = GROUP_OF[object] ?? object;

    if (!byGroup.has(id)) {
      byGroup.set(id, {
        id,
        known: isGroupId(id) ? id : null,
        fallback: object.charAt(0).toUpperCase() + object.slice(1),
        permissions: [],
      });
    }
    byGroup.get(id)?.permissions.push(permission);
  }

  const rank = (group: Group) =>
    group.known === null ? 99 : GROUP_ORDER[group.known];

  return [...byGroup.values()].sort((a, b) => rank(a) - rank(b));
}
