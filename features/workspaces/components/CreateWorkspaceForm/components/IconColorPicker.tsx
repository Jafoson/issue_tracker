"use client";

import { useTranslations } from "next-intl";
import { COLORS } from "@/styles/colors";
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
      <div className={styles.swatches}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch}${c === color ? ` ${styles.swatchActive}` : ""}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}
