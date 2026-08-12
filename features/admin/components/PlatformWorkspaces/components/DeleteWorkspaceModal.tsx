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
 * Einen Mandanten endgültig löschen.
 *
 * Der Dialog sagt zuerst, was verschwindet — mit den Zahlen dieses Workspace,
 * nicht als allgemeine Warnung. „Dabei gehen 3 Projekte, 24 Aufgaben und 7
 * Mitgliedschaften verloren" ist eine Auskunft; „diese Aktion kann nicht
 * rückgängig gemacht werden" ist eine Floskel, die jeder wegklickt.
 *
 * Danach der Name zum Abtippen. Nicht als Schikane: er stellt sicher, dass die
 * Zeile, auf der man gerade stand, auch die Zeile ist, die man meint — der
 * häufigste Weg zum falschen Löschen ist ein Klick in der falschen Reihe.
 *
 * Die eigentliche Sicherung liegt trotzdem woanders, nämlich davor: löschen geht
 * nur, was schon gesperrt ist, und das prüft der Server
 * (`features/admin/actions.ts`). Zwischen Sperren und Löschen liegt damit
 * mindestens eine bewusste zweite Handlung.
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
