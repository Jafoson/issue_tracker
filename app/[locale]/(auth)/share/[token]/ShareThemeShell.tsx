"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import { Link } from "@/i18n/navigation";
import styles from "./shareThemeShell.module.scss";

/**
 * Header + theme for the public issue page — light by default, with a
 * toggle, independent of a signed-in account's preference (there isn't one
 * here; `data-theme` normally lives on `<html>` and comes from
 * `getMyPreferences()`). A `data-theme` here on the wrapper works the same
 * way — the same tokens from `styles/colors.scss`, just scoped locally to
 * this subtree instead of the whole page.
 *
 * `.page` is itself a full-height flex column, so the footer and the "join
 * the discussion" box (part of `children`) stay at the bottom even when a
 * short issue doesn't fill the page — no floating up in the middle.
 */
export function ShareThemeShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleLabel =
    theme === "light" ? t("share.themeDark") : t("share.themeLight");

  return (
    <div data-theme={theme} className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.logo}>O</span>
          <span className={styles.brandName}>Orbit</span>
          <Badge mono={false} className={styles.badge}>
            <Icon icon="lucide:globe-2" width={13} />
            {t("share.publicBadge")}
          </Badge>
        </div>
        <div className={styles.navActions}>
          <Button
            variant="ghost"
            size="md"
            icon={
              <Icon
                icon={theme === "light" ? "lucide:moon" : "lucide:sun"}
                width={17}
              />
            }
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={() => setTheme((v) => (v === "light" ? "dark" : "light"))}
          />
          <Link
            href="/login"
            className={[
              buttonStyles.btn,
              buttonStyles.text,
              buttonStyles.md,
            ].join(" ")}
          >
            {t("actions.signIn")}
          </Link>
          <Link
            href="/register"
            className={[
              buttonStyles.btn,
              buttonStyles.primary,
              buttonStyles.md,
            ].join(" ")}
          >
            {t("share.signup")}
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
