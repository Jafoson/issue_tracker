"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { Label } from "@/components/ui/atoms/Label/Label";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { UserCell } from "@/components/ui/atoms/UserCell/UserCell";
import {
  ModalFooter,
  ModalShortcut,
} from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import {
  addProjectMembers,
  inviteProjectMember,
} from "@/features/projects/actions";
import { fullName } from "@/lib/utils/string";
import { useSubmitShortcut } from "@/lib/utils/useSubmitShortcut";
import type { Role, User } from "@/types";
import styles from "./addProjectMembersModal.module.scss";

type Mode = "workspace" | "invite";

interface AddProjectMembersModalProps {
  projectId: string;
  projectName: string;
  /** Workspace-Mitglieder ohne eigenen Projekt-Eintrag. */
  candidates: User[];
  /** Rollen, die der aktuelle User vergeben darf. */
  roles: Role[];
  defaultRole: string;
  /** Ohne dieses Recht fehlt der E-Mail-Weg — neue Accounts sind tabu. */
  canInvite: boolean;
  close: () => void;
}

/**
 * Zwei Wege ins Projekt: bestehende Workspace-Mitglieder auswählen oder eine
 * fremde Adresse einladen. Beide enden mit derselben Rolle, deshalb steht der
 * Rollen-Picker unter beiden Modi statt in jedem einzeln.
 */
export function AddProjectMembersModal({
  projectId,
  projectName,
  candidates,
  roles,
  defaultRole,
  canInvite,
  close,
}: AddProjectMembersModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>(
    // Sind alle schon im Projekt, wäre die Auswahlliste leer — dann startet der
    // Dialog gleich beim Einladen.
    candidates.length === 0 && canInvite ? "invite" : "workspace",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [error, setError] = useState("");
  // Entsteht beim Einladen einer unbekannten Adresse: das Konto hat kein
  // Passwort, dieser Link ist der einzige Weg hinein. Er geht per Mail raus,
  // wenn SMTP konfiguriert ist (`mailSent`) — der Dialog zeigt ihn trotzdem,
  // statt zu schließen, für den Fall ohne Mailversand oder eine hakende
  // Zustellung.
  const [inviteUrl, setInviteUrl] = useState("");
  const [mailSent, setMailSent] = useState(false);

  const roleName = roles.find((r) => r.id === role)?.name ?? role;

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? candidates.filter((user) =>
        `${fullName(user)} ${user.email}`.toLowerCase().includes(needle),
      )
    : candidates;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const canSubmit =
    !isPending &&
    !!role &&
    (mode === "workspace" ? selected.size > 0 : email.trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    setError("");
    startTransition(async () => {
      const result =
        mode === "workspace"
          ? await addProjectMembers({
              projectId,
              userIds: [...selected],
              role,
            })
          : await inviteProjectMember({ projectId, email, role });

      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      // Ein neu entstandenes Konto braucht seinen Einladungslink — der Dialog
      // bleibt offen, bis er kopiert werden konnte.
      if (result.inviteUrl) {
        setInviteUrl(result.inviteUrl);
        setMailSent(!!result.mailSent);
        return;
      }
      close();
    });
  };

  const finish = () => {
    router.refresh();
    close();
  };

  useSubmitShortcut(inviteUrl ? finish : submit);

  return (
    <Modal width={520}>
      <ModalHeader
        leading={
          <Icon
            icon={inviteUrl ? "lucide:mail-check" : "lucide:user-plus"}
            width={16}
            className={styles.headerIcon}
          />
        }
        title={
          inviteUrl
            ? t("members.inviteLinkTitle")
            : t("projectMembers.addTitle", { project: projectName })
        }
        onClose={finish}
        closeLabel={t("actions.close")}
      />

      {inviteUrl ? (
        <ModalBody className={styles.body}>
          <p className={styles.inviteLinkDesc}>
            {t(
              mailSent
                ? "members.inviteLinkDescMailed"
                : "members.inviteLinkDesc",
            )}
          </p>
          <CopyField
            value={inviteUrl}
            copyLabel={t("members.inviteLinkCopy")}
            copiedLabel={t("members.inviteLinkCopied")}
          />
        </ModalBody>
      ) : (
        <ModalBody className={styles.body}>
          {canInvite && (
            <SegmentedControl
              items={[
                {
                  value: "workspace",
                  label: t("projectMembers.fromWorkspace"),
                },
                { value: "invite", label: t("projectMembers.byEmail") },
              ]}
              value={mode}
              onChange={(value) => {
                setMode(value as Mode);
                setError("");
              }}
            />
          )}

          {mode === "workspace" ? (
            candidates.length === 0 ? (
              <EmptyState
                icon={<Icon icon="lucide:users" width={28} />}
                title={t("projectMembers.allAdded")}
                description={
                  canInvite ? t("projectMembers.allAddedHint") : undefined
                }
              />
            ) : (
              <>
                <Input
                  autoFocus
                  variant="search"
                  size="sm"
                  placeholder={t("projectMembers.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />

                <ul className={styles.list}>
                  {filtered.map((user) => {
                    const isSelected = selected.has(user.id);
                    return (
                      <li key={user.id}>
                        <button
                          type="button"
                          className={styles.candidate}
                          aria-pressed={isSelected}
                          onClick={() => toggle(user.id)}
                        >
                          <UserCell
                            avatar={user}
                            name={fullName(user)}
                            meta={user.email}
                            size={28}
                            trailing={
                              user.pending && (
                                <Label size="xs" color="var(--amber)">
                                  {t("projectMembers.pending")}
                                </Label>
                              )
                            }
                          />
                          <Icon
                            className={styles.check}
                            icon={isSelected ? "lucide:check" : "lucide:plus"}
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
              </>
            )
          ) : (
            <Input
              autoFocus
              label={t("fields.email")}
              hint={t("projectMembers.inviteHint")}
              placeholder="ada@example.com"
              value={email}
              spellCheck={false}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          <div className={styles.roleRow}>
            <span className={styles.roleLabel}>{t("fields.role")}</span>
            <InlinePicker
              trigger={
                <Badge as="button" mono={false} active>
                  {roleName}
                  <Icon icon="lucide:chevron-down" width={12} />
                </Badge>
              }
              width={220}
            >
              {(closePicker) => (
                <SelectMenu
                  items={roles.map((r) => ({ value: r.id, label: r.name }))}
                  value={role}
                  onPick={(value) => {
                    setRole(String(value));
                    closePicker();
                  }}
                  onClose={closePicker}
                />
              )}
            </InlinePicker>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </ModalBody>
      )}

      <ModalFooter
        hint={
          inviteUrl ? undefined : (
            <ModalShortcut keys={["⌘", "↵"]}>
              {mode === "workspace"
                ? t("projectMembers.toAdd")
                : t("projectMembers.toInvite")}
            </ModalShortcut>
          )
        }
      >
        {inviteUrl ? (
          <Button variant="primary" onClick={finish}>
            {t("actions.close")}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t("actions.cancel")}
            </Button>
            <Button variant="primary" disabled={!canSubmit} onClick={submit}>
              {mode === "workspace"
                ? t("projectMembers.addSelected", { count: selected.size })
                : t("actions.inviteMember")}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
