"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { Label } from "@/components/ui/atoms/Label/Label";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import {
  ModalFooter,
  ModalShortcut,
} from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { inviteWorkspaceMember } from "@/features/workspaces/actions";
import { roleColor } from "@/lib/rbac";
import { useSubmitShortcut } from "@/lib/utils/useSubmitShortcut";
import type { Role } from "@/types";
import styles from "./inviteMemberModal.module.scss";

interface Props {
  workspaceId: string;
  /** Rollen, die der aktuelle User vergeben darf — vom Server gefiltert. */
  roles: Role[];
  close: () => void;
}

/**
 * Jemanden per E-Mail in den Workspace einladen.
 *
 * Zwei Ausgänge, und der Dialog zeigt beide: ein bekanntes Konto ist danach
 * einfach dabei, für eine unbekannte Adresse entsteht ein Einladungslink. Der
 * geht per Mail raus, wenn SMTP konfiguriert ist (`mailSent`) — der Link
 * bleibt trotzdem stehen, bis er kopiert wurde, statt mit dem Dialog zu
 * verschwinden, für den Fall ohne Mailversand oder eine hakende Zustellung.
 */
export function InviteMemberModal({ workspaceId, roles, close }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState(
    roles.find((r) => r.id === "member")?.id ?? roles.at(-1)?.id ?? "",
  );
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [mailSent, setMailSent] = useState(false);
  const [added, setAdded] = useState("");

  const selected = roles.find((r) => r.id === role);
  const done = !!inviteUrl || !!added;

  const submit = () => {
    if (done) {
      finish();
      return;
    }
    if (!email.trim() || !role || isPending) return;
    setError("");

    startTransition(async () => {
      const result = await inviteWorkspaceMember({
        workspaceId,
        email: email.trim(),
        role,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.inviteUrl) {
        setInviteUrl(result.inviteUrl);
        setMailSent(!!result.mailSent);
      } else {
        setAdded(email.trim());
      }
      router.refresh();
    });
  };

  const finish = () => {
    router.refresh();
    close();
  };

  useSubmitShortcut(submit);

  return (
    <Modal width={520}>
      <ModalHeader
        leading={
          <Icon
            icon={done ? "lucide:mail-check" : "lucide:user-plus"}
            width={16}
            className={styles.headerIcon}
          />
        }
        title={
          inviteUrl ? t("members.inviteLinkTitle") : t("members.inviteTitle")
        }
        onClose={finish}
        closeLabel={t("actions.close")}
      />

      <ModalBody className={styles.body}>
        {done ? (
          <>
            <p className={styles.desc}>
              {inviteUrl
                ? t(
                    mailSent
                      ? "members.inviteLinkDescMailed"
                      : "members.inviteLinkDesc",
                  )
                : t("members.inviteAdded", { email: added })}
            </p>
            {inviteUrl && (
              <CopyField
                value={inviteUrl}
                copyLabel={t("members.inviteLinkCopy")}
                copiedLabel={t("members.inviteLinkCopied")}
              />
            )}
          </>
        ) : (
          <>
            <p className={styles.desc}>{t("members.inviteDesc")}</p>

            <Input
              autoFocus
              label={t("fields.email")}
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />

            <div className={styles.field}>
              <span className={styles.label}>{t("fields.role")}</span>
              <InlinePicker
                trigger={
                  <button type="button" className={styles.roleTrigger}>
                    <Label
                      size="sm"
                      filled
                      color={roleColor(selected?.rank ?? 0)}
                    >
                      {selected?.name ?? role}
                    </Label>
                    <Icon icon="lucide:chevron-down" width={14} />
                  </button>
                }
                width={240}
                stop
              >
                {(closePicker) => (
                  <SelectMenu
                    items={roles.map((r) => ({
                      value: r.id,
                      label: r.name,
                      hint: r.desc,
                    }))}
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

            {error && (
              <p className={styles.error} role="alert">
                <Icon icon="lucide:circle-alert" width={14} />
                {error}
              </p>
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter
        hint={
          done ? undefined : (
            <ModalShortcut keys={["⌘", "↵"]}>
              {t("projectMembers.toInvite")}
            </ModalShortcut>
          )
        }
      >
        {done ? (
          <Button variant="primary" onClick={finish}>
            {t("actions.close")}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t("actions.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={!email.trim() || !role || isPending}
              onClick={submit}
            >
              {t("actions.inviteMember")}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
