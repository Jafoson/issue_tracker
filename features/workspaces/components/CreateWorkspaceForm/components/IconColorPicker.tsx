"use client";

import { useTranslations } from "next-intl";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import styles from "../createWorkspaceForm.module.scss";

interface IconColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function IconColorPicker({ color, onChange }: IconColorPickerProps) {
  const t = useTranslations();

  return (
    <div className={styles.field}>
      <span className={styles.label}>{t("workspaces.iconColor")}</span>
      <ColorPicker value={color} onChange={onChange} />
    </div>
  );
}
