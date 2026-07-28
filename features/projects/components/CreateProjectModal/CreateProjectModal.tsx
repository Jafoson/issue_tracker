"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import {
  ModalFooter,
  ModalShortcut,
} from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { createProject } from "@/features/projects/actions";
import { useSubmitShortcut } from "@/lib/utils/useSubmitShortcut";
import { COLORS } from "@/styles/colors";
import styles from "./createProjectModal.module.scss";

/** Der Prefix ist die Issue-Kennung (WEB-123) — max. 4 alphanumerische Zeichen. */
function suggestPrefix(name: string) {
  return name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
}

interface CreateProjectModalProps {
  workspaceId: string;
  close: () => void;
}

export function CreateProjectModal({
  workspaceId,
  close,
}: CreateProjectModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");

  // Solange der Prefix nicht von Hand angefasst wurde, folgt er dem Namen.
  const effectivePrefix = prefixTouched ? prefix : suggestPrefix(name);

  const submit = () => {
    if (!name.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await createProject({
        workspaceId,
        name: name.trim(),
        prefix: effectivePrefix,
        color,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      close();
    });
  };

  useSubmitShortcut(submit);

  return (
    <Modal>
      <ModalHeader
        leading={
          <Icon
            icon="lucide:columns-2"
            width={16}
            className={styles.headerIcon}
          />
        }
        title={t("projects.modalTitle")}
        onClose={close}
        closeLabel={t("actions.close")}
      />

      <ModalBody className={styles.body}>
        <Input
          autoFocus
          label={t("placeholders.projectName")}
          placeholder="Web App"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className={styles.prefixRow}>
          <Input
            className={styles.prefixInput}
            label={t("projects.identifier")}
            hint={`${t("projects.example")} ${effectivePrefix || "WEB"}-123`}
            placeholder="WEB"
            value={effectivePrefix}
            spellCheck={false}
            maxLength={4}
            onChange={(e) => {
              setPrefixTouched(true);
              setPrefix(suggestPrefix(e.target.value));
            }}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t("fields.color")}</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </ModalBody>

      <ModalFooter
        hint={
          <ModalShortcut keys={["⌘", "↵"]}>
            {t("projects.toCreate")}
          </ModalShortcut>
        }
      >
        <Button variant="ghost" onClick={close}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={!name.trim() || isPending}
          onClick={submit}
        >
          {t("actions.createProject")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
