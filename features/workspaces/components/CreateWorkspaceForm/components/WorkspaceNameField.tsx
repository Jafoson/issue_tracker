"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Input } from "@/components/ui/atoms/Input/Input";
import styles from "../createWorkspaceForm.module.scss";

interface WorkspaceNameFieldProps {
  name: string;
  onNameChange: (value: string) => void;
  color: string;
  nameRef: React.RefObject<HTMLInputElement | null>;
}

export function WorkspaceNameField({
  name,
  onNameChange,
  color,
  nameRef,
}: WorkspaceNameFieldProps) {
  const t = useTranslations();

  return (
    <div className={styles.nameRow}>
      <Avatar avatar={{ name: name || "Workspace", color }} size={64} />
      <div className={styles.nameField}>
        <Input
          ref={nameRef}
          id="ws-name"
          label={t("workspaces.name")}
          placeholder={t("workspaces.namePlaceholder")}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
    </div>
  );
}
