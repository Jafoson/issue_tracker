"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { deleteWorkspaceAsPlatform } from "@/features/admin/actions";
import type { PlatformWorkspace } from "@/features/admin/queries";
import styles from "./deleteWorkspaceModal.module.scss";

interface Props {
  workspace: PlatformWorkspace;
  close: () => void;
}

/**
 * Permanently delete a tenant.
 *
 * The dialog states first what disappears — with this workspace's actual
 * numbers, not as a generic warning. "This will lose 3 projects, 24 issues,
 * and 7 memberships" is information; "this action cannot be undone" is a
 * stock phrase everyone clicks past.
 *
 * After that, the name to retype. Not as an obstacle: it makes sure the row
 * you happened to be on is also the row you meant — the most common way to
 * delete the wrong thing is a click in the wrong row.
 *
 * The actual safeguard sits elsewhere anyway, upstream: only something
 * already suspended can be deleted, and the server checks that
 * (`features/admin/actions.ts`). Between suspending and deleting there is
 * thus at least one deliberate second action.
 */
export function DeleteWorkspaceModal({ workspace, close }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  const matches = typed.trim() === workspace.name;

  const submit = () => {
    if (!matches || isPending) return;
    startTransition(async () => {
      const result = await deleteWorkspaceAsPlatform(
        workspace.id,
        typed.trim(),
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      close();
    });
  };

  return (
    <Modal width={520}>
      <ModalHeader
        leading={
          <Icon
            icon="lucide:trash-2"
            width={16}
            className={styles.headerIcon}
          />
        }
        title={t("platformWorkspaces.deleteTitle", { name: workspace.name })}
        onClose={close}
        closeLabel={t("actions.close")}
      />

      <ModalBody className={styles.body}>
        <p className={styles.desc}>{t("platformWorkspaces.deleteDesc")}</p>

        <ul className={styles.losses}>
          <li>
            <span className={styles.lossValue}>{workspace.projects}</span>
            {t("platform.projects")}
          </li>
          <li>
            <span className={styles.lossValue}>{workspace.issues}</span>
            {t("dashboard.issues")}
          </li>
          <li>
            <span className={styles.lossValue}>{workspace.members}</span>
            {t("platformWorkspaces.memberships")}
          </li>
        </ul>

        <Input
          label={t("platformWorkspaces.deleteConfirmLabel", {
            name: workspace.name,
          })}
          value={typed}
          disabled={isPending}
          autoFocus
          autoComplete="off"
          onChange={(event) => {
            setTyped(event.target.value);
            setError("");
          }}
        />

        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="text" onClick={close} disabled={isPending}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          className={styles.danger}
          onClick={submit}
          disabled={!matches || isPending}
        >
          {t("platformWorkspaces.deleteConfirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
