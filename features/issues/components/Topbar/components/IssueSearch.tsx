"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import styles from "../topbar.module.scss";

interface IssueSearchProps {
  /** Seed only — the URL value at mount. The box owns its text from then on. */
  initialValue: string;
  onChange: (value: string) => void;
}

/**
 * Free-text filter over the current view — matches issue title, body and ID.
 *
 * Holds the typed text itself, so a keystroke renders this input and nothing
 * else; the rest of the topbar follows only once the debounced `?q=` lands.
 * `initialValue` seeds the box on mount and is deliberately never read again:
 * a landing navigation always carries older text than the screen, and adopting
 * it would swallow characters. The URL is write-only from here on.
 */
export function IssueSearch({ initialValue, onChange }: IssueSearchProps) {
  const t = useTranslations();
  const [value, setValue] = useState(initialValue);
  const placeholder = t("placeholders.filterIssues");

  function update(next: string) {
    setValue(next);
    onChange(next);
  }

  return (
    <div className={styles.search}>
      <Input
        variant="search"
        size="md"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") update("");
        }}
        iconRight={
          value ? (
            <button
              type="button"
              aria-label={t("actions.clear")}
              onClick={() => update("")}
            >
              <Icon icon="lucide:x" width={13} />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
