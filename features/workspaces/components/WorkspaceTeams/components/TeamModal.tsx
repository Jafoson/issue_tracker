"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { UserCell } from "@/components/ui/atoms/UserCell/UserCell";
import {
  ModalFooter,
  ModalShortcut,
} from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { createTeam, updateTeam } from "@/features/workspaces/actions";
import type { WorkspaceTeamRow } from "@/features/workspaces/types";
import { PALETTE } from "@/lib/utils";
import { fullName } from "@/lib/utils/string";
import { useSubmitShortcut } from "@/lib/utils/useSubmitShortcut";
import type { User } from "@/types";
import styles from "./teamModal.module.scss";

interface Props {
  workspaceId: string;
  /** Gesetzt = bearbeiten, offen = anlegen. */
  team?: WorkspaceTeamRow;
  /** Mitglieder des Workspace — nur sie können in ein Team. */
  candidates: User[];
  projects: { id: string; name: string; color: string }[];
  /** Rollen, die sich einem Projekt zuweisen lassen — siehe Typ-Kommentar. */
  assignableProjectRoles: { key: string; name: string; rank: number }[];
  canManageMembers: boolean;
  canManageProjects: boolean;
  onDone: () => void;
  close: () => void;
}

/** Kürzel wie beim Projekt: bis zu vier Zeichen, Buchstaben und Ziffern. */
function suggestKey(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
}

function toggle(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

/**
 * Anlegen und Bearbeiten in einem Dialog — es sind dieselben Felder.
 *
 * Vier Angaben machen das Team (Name, Kürzel, Farbe, Lead), zwei Listen füllen
 * es (Mitglieder, Projekte). Die Listen stehen nur da, wo sie auch bedienbar
 * sind: `team.member.manage` und `team.project.manage` sind eigene Rechte, und
 * eine Auswahl, die beim Speichern stillschweigend verfällt, wäre eine Lüge.
 *
 * Der Lead ist zugleich Mitglied — der Server nimmt ihn ohnehin in die Liste
 * auf, hier steht er deshalb schon markiert.
 *
 * Ein gewähltes Projekt trägt zusätzlich eine Rolle (oder keine, für reine
 * Gruppierung) — sie ist es, die Mitglieder des Teams dort bekommen
 * (`syncProjectTeamRoles`, lib/project-membership.ts). Neu gewählte Projekte
 * starten ohne Rolle: wer eine vergeben will, wählt sie ausdrücklich, statt
 * dass ein Häkchen im Vorbeigehen Zugriff verleiht.
 */
export function TeamModal({
  workspaceId,
  team,
  candidates,
  projects,
  assignableProjectRoles,
  canManageMembers,
  canManageProjects,
  onDone,
  close,
}: Props) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(team?.name ?? "");
  const [key, setKey] = useState(team?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(team));
  const [color, setColor] = useState(team?.color ?? PALETTE[0]);
  const [desc, setDesc] = useState(team?.desc ?? "");
  const [leadId, setLeadId] = useState(
    team?.lead?.id ?? candidates[0]?.id ?? "",
  );
  const [members, setMembers] = useState<ReadonlySet<string>>(
    new Set(team?.members.map((m) => m.id) ?? []),
  );
  // Projekt-Id → Rollen-Key, oder `null` für reine Gruppierung ohne Rolle. Wer
  // in der Map steht, ist ausgewählt — das ersetzt das frühere `Set`.
  const [projectRoles, setProjectRoles] = useState<
    ReadonlyMap<string, string | null>
  >(new Map(team?.projects.map((p) => [p.id, p.role?.key ?? null]) ?? []));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const trimmed = name.trim();
  // Solange das Kürzel nicht von Hand angefasst wurde, folgt es dem Namen.
  const effectiveKey = keyTouched ? key : suggestKey(trimmed);
  // Der bisherige Lead steht als Rückfall daneben: er kann den Workspace
  // verlassen haben und fehlt dann in der Auswahl — der Auslöser soll trotzdem
  // sagen, wer eingetragen ist, statt „Person wählen" zu zeigen.
  const lead = candidates.find((c) => c.id === leadId) ?? team?.lead ?? null;

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? candidates.filter((user) =>
        `${fullName(user)} ${user.email}`.toLowerCase().includes(needle),
      )
    : candidates;

  const projectById = new Map(projects.map((p) => [p.id, p]));
  // Nur, was noch nicht dabei ist, taugt als Angebot im Dropdown — ein
  // Projekt steht im Team höchstens einmal.
  const availableProjects = projects.filter((p) => !projectRoles.has(p.id));

  const submit = () => {
    if (!trimmed || !leadId || isPending) return;

    const data = {
      name: trimmed,
      key: effectiveKey,
      color,
      desc,
      leadId,
      memberIds: [...members],
      projects: [...projectRoles].map(([projectId, roleKey]) => ({
        projectId,
        roleKey,
      })),
    };

    startTransition(async () => {
      const result = team
        ? await updateTeam(team.id, data)
        : await createTeam(workspaceId, data);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onDone();
      close();
    });
  };

  useSubmitShortcut(submit);

  return (
    <Modal width={560}>
      <ModalHeader
        leading={
          <Icon
            icon="lucide:users-round"
            width={16}
            className={styles.headerIcon}
          />
        }
        title={
          team ? t("workspaceTeams.editTitle") : t("workspaceTeams.newTitle")
        }
        onClose={close}
        closeLabel={t("actions.cancel")}
      />

      <ModalBody className={styles.body}>
        <div className={styles.row}>
          <Input
            autoFocus
            className={styles.grow}
            label={t("fields.name")}
            placeholder={t("workspaceTeams.namePlaceholder")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
          <Input
            className={styles.keyInput}
            label={t("workspaceTeams.key")}
            value={effectiveKey}
            spellCheck={false}
            maxLength={4}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(suggestKey(e.target.value));
              setError("");
            }}
          />
        </div>

        <Input
          label={t("fields.description")}
          placeholder={t("workspaceTeams.descPlaceholder")}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />

        <div className={styles.field}>
          <span className={styles.label}>{t("fields.color")}</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t("workspaceTeams.lead")}</span>
          <InlinePicker
            trigger={
              <Badge as="button" mono={false} active>
                {lead ? fullName(lead) : t("workspaceTeams.pickLead")}
                <Icon icon="lucide:chevron-down" width={12} />
              </Badge>
            }
            width={260}
            stop
          >
            {(closePicker) => (
              <SelectMenu
                items={candidates.map((user) => ({
                  value: user.id,
                  label: fullName(user),
                  hint: user.email ?? undefined,
                }))}
                value={leadId}
                onPick={(value) => {
                  const next = String(value);
                  setLeadId(next);
                  // Wer führt, ist dabei — sonst stünde in der Zeile ein
                  // Verantwortlicher, der nicht zum Team gehört.
                  setMembers((prev) => new Set(prev).add(next));
                  closePicker();
                }}
                onClose={closePicker}
              />
            )}
          </InlinePicker>
        </div>

        {canManageMembers && (
          <div className={styles.field}>
            <span className={styles.label}>
              {t("workspaceTeams.membersCount", { count: members.size })}
            </span>
            <Input
              variant="search"
              size="sm"
              placeholder={t("projectMembers.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className={styles.list}>
              {filtered.map((user) => {
                const picked = members.has(user.id);
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      className={styles.option}
                      aria-pressed={picked}
                      onClick={() =>
                        setMembers((prev) => toggle(prev, user.id))
                      }
                    >
                      <UserCell
                        avatar={user}
                        name={fullName(user)}
                        meta={user.email}
                        size={26}
                      />
                      <Icon
                        className={styles.check}
                        icon={picked ? "lucide:check" : "lucide:plus"}
                        width={15}
                      />
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className={styles.noResults}>
                  {t("empty.noResults", { q: query })}
                </li>
              )}
            </ul>
          </div>
        )}

        {canManageProjects && projects.length > 0 && (
          <div className={styles.field}>
            <div className={styles.projectsHead}>
              <span className={styles.label}>
                {t("workspaceTeams.projectsCount", {
                  count: projectRoles.size,
                })}
              </span>

              {availableProjects.length > 0 && (
                <InlinePicker
                  trigger={
                    <button type="button" className={styles.addProject}>
                      <Icon icon="lucide:plus" width={13} />
                      {t("workspaceTeams.addProject")}
                    </button>
                  }
                  width={240}
                  stop
                >
                  {(closePicker) => (
                    <SelectMenu
                      searchable={availableProjects.length > 6}
                      items={availableProjects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      }))}
                      value=""
                      onPick={(value) => {
                        // Neu hinzugefügt heißt ohne Rolle: wer eine vergeben
                        // will, wählt sie im nächsten Schritt ausdrücklich.
                        setProjectRoles((prev) =>
                          new Map(prev).set(String(value), null),
                        );
                        closePicker();
                      }}
                      onClose={closePicker}
                    />
                  )}
                </InlinePicker>
              )}
            </div>

            {projectRoles.size > 0 ? (
              <ul className={styles.projectList}>
                {[...projectRoles.keys()].map((projectId) => {
                  const project = projectById.get(projectId);
                  if (!project) return null;
                  const roleKey = projectRoles.get(projectId) ?? null;
                  const roleName = roleKey
                    ? (assignableProjectRoles.find((r) => r.key === roleKey)
                        ?.name ?? roleKey)
                    : t("workspaceTeams.noRole");

                  return (
                    <li key={projectId} className={styles.projectRow}>
                      <span className={styles.projectName}>
                        <span
                          className={styles.chipDot}
                          style={{ background: project.color }}
                          aria-hidden
                        />
                        {project.name}
                      </span>

                      <InlinePicker
                        trigger={
                          <button
                            type="button"
                            className={styles.roleChip}
                            title={t("workspaceTeams.projectRole")}
                          >
                            {roleName}
                            <Icon icon="lucide:chevron-down" width={11} />
                          </button>
                        }
                        width={200}
                        stop
                      >
                        {(closePicker) => (
                          <SelectMenu
                            items={[
                              { value: "", label: t("workspaceTeams.noRole") },
                              ...assignableProjectRoles.map((r) => ({
                                value: r.key,
                                label: r.name,
                              })),
                            ]}
                            value={roleKey ?? ""}
                            onPick={(value) => {
                              const next = String(value) || null;
                              setProjectRoles((prev) =>
                                new Map(prev).set(projectId, next),
                              );
                              closePicker();
                            }}
                            onClose={closePicker}
                          />
                        )}
                      </InlinePicker>

                      <button
                        type="button"
                        className={styles.removeProject}
                        aria-label={t("actions.remove")}
                        title={t("actions.remove")}
                        onClick={() =>
                          setProjectRoles((prev) => {
                            const next = new Map(prev);
                            next.delete(projectId);
                            return next;
                          })
                        }
                      >
                        <Icon icon="lucide:x" width={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.noResults}>
                {t("workspaceTeams.noProjectsPicked")}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}
      </ModalBody>

      <ModalFooter hint={<ModalShortcut keys={["⌘", "↵"]} />}>
        <Button variant="ghost" disabled={isPending} onClick={close}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={!trimmed || !leadId || isPending}
          onClick={submit}
        >
          {team ? t("actions.save") : t("actions.create")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
