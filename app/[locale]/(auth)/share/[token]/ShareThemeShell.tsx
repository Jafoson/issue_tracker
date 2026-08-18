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
 * Kopfzeile + Design für die öffentliche Issue-Seite — hell als Vorgabe, mit
 * einem Umschalter, unabhängig von der Vorliebe eines eingeloggten Kontos
 * (die gibt es hier nicht, `data-theme` sitzt sonst am `<html>` und kommt aus
 * `getMyPreferences()`). Ein `data-theme` hier am Wrapper wirkt genauso —
 * dieselben Tokens aus `styles/colors.scss`, nur lokal auf diesen Ast begrenzt
 * statt für die ganze Seite.
 *
 * `.page` ist selbst eine Flex-Spalte über die volle Höhe, damit Fuß und
 * "Mitdiskutieren"-Kasten (Teil von `children`) am unteren Rand bleiben, auch
 * wenn ein kurzes Issue die Seite nicht füllt — kein Aufschwimmen in der
 * Mitte.
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
