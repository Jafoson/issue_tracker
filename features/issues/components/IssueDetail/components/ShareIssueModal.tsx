"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import {
  disableIssueShare,
  enableIssueShare,
  shareIssueByEmail,
  shareIssueWithMember,
} from "@/features/issues/actions";
import { isValidEmail } from "@/lib/utils/parse-emails";
import { fullName } from "@/lib/utils/string";
import type { User } from "@/types";
import styles from "./shareIssueModal.module.scss";

interface Props {
  issueId: string;
  /** Fertige URL vom Server — `null`, solange Teilen aus ist. */
  shareUrl: string | null;
  /** Workspace-weit, wie beim Zuständigkeits-Feld — ohne die eigene Person. */
  members: User[];
  me: { id: string };
  close: () => void;
}

/**
 * Öffentlichen Lese-Link ein-/ausschalten — bewusst nur der Link-Teil des
 * Jira-Vorbilds, ohne dessen Slack-Tab (nicht angefragt). Zusätzlich zwei
 * direkte Wege, ohne den Link selbst weiterzureichen: an ein Mitglied (in-app
 * + ggf. Mail, `shareIssueWithMember`) oder an eine beliebige Adresse
 * (`shareIssueByEmail`, verschickt immer den öffentlichen Link, schaltet ihn
 * bei Bedarf still mit ein).
 */
export function ShareIssueModal({
  issueId,
  shareUrl: initial,
  members,
  me,
  close,
}: Props) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [shareUrl, setShareUrl] = useState(initial);
  const [error, setError] = useState("");

  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberMessage, setMemberMessage] = useState("");
  const [memberSent, setMemberSent] = useState(false);

  const [email, setEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const pickableMembers = members.filter((m) => m.id !== me.id);
  const selectedMember = pickableMembers.find((m) => m.id === memberId);

  const toggleLink = (checked: boolean) => {
    setError("");
    startTransition(async () => {
      try {
        if (checked) {
          const result = await enableIssueShare(issueId);
          setShareUrl(result.url);
        } else {
          await disableIssueShare(issueId);
          setShareUrl(null);
        }
      } catch {
        setError(t("share.actionFailed"));
      }
    });
  };

  const sendToMember = () => {
    if (!memberId || isPending) return;
    setError("");
    startTransition(async () => {
      try {
        await shareIssueWithMember(issueId, memberId, memberMessage);
        setMemberSent(true);
        setMemberId(null);
        setMemberMessage("");
        window.setTimeout(() => setMemberSent(false), 2000);
      } catch {
        setError(t("share.actionFailed"));
      }
    });
  };

  const sendByEmail = () => {
    if (!email || isPending) return;
    if (!isValidEmail(email)) {
      setError(t("share.invalidEmail"));
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await shareIssueByEmail(issueId, email, emailMessage);
      if ("error" in result) {
        setError(t("share.invalidEmail"));
        return;
      }
      setShareUrl(result.url);
      setEmailSent(true);
      setEmail("");
      setEmailMessage("");
      window.setTimeout(() => setEmailSent(false), 2000);
    });
  };

  return (
    <Modal width={480}>
      <ModalHeader
        leading={
          <Icon icon="lucide:link" width={16} className={styles.headerIcon} />
        }
        title={t("share.modalTitle")}
        onClose={close}
        closeLabel={t("actions.close")}
      />

      <ModalBody className={styles.body}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <div className={styles.row}>
          <span className={styles.rowIcon}>
            <Icon icon="lucide:globe-2" width={16} />
          </span>
          <p className={styles.rowText}>{t("share.modalDesc")}</p>
          <Switch
            checked={shareUrl !== null}
            onChange={toggleLink}
            disabled={isPending}
            label={t("share.enable")}
            labelHidden
          />
        </div>

        {shareUrl && (
          <CopyField
            value={shareUrl}
            copyLabel={t("members.inviteLinkCopy")}
            copiedLabel={t("members.inviteLinkCopied")}
          />
        )}

        {pickableMembers.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>
              {t("share.withMemberTitle")}
            </span>
            <div className={styles.sectionRow}>
              <InlinePicker
                width={240}
                stop
                trigger={
                  <button type="button" className={styles.memberTrigger}>
                    {selectedMember ? (
                      <>
                        <Avatar avatar={selectedMember} size={18} />
                        {fullName(selectedMember)}
                      </>
                    ) : (
                      t("share.withMemberPlaceholder")
                    )}
                    <Icon icon="lucide:chevron-down" width={14} />
                  </button>
                }
              >
                {(closePicker) => (
                  <SelectMenu
                    items={pickableMembers.map((user) => ({
                      value: user.id,
                      label: fullName(user),
                      icon: <Avatar avatar={user} size={18} />,
                    }))}
                    value={memberId}
                    onPick={(value) => {
                      setMemberId(value as string);
                      closePicker();
                    }}
                    onClose={closePicker}
                    searchable
                  />
                )}
              </InlinePicker>
              <Button
                variant="elevated"
                size="sm"
                disabled={!memberId || isPending}
                onClick={sendToMember}
              >
                {memberSent
                  ? t("share.withMemberSent")
                  : t("share.withMemberSend")}
              </Button>
            </div>
            <Input
              size="sm"
              value={memberMessage}
              onChange={(e) => setMemberMessage(e.target.value)}
              placeholder={t("share.withMemberMessagePlaceholder")}
            />
          </div>
        )}

        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t("share.byEmailTitle")}</span>
          <div className={styles.sectionRow}>
            <Input
              size="sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("share.byEmailPlaceholder")}
            />
            <Button
              variant="elevated"
              size="sm"
              disabled={!email || isPending}
              onClick={sendByEmail}
            >
              {emailSent ? t("share.byEmailSent") : t("share.byEmailSend")}
            </Button>
          </div>
          <Input
            size="sm"
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            placeholder={t("share.withMemberMessagePlaceholder")}
          />
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={close}>
          {t("actions.close")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
