"use client";

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import styles from "./settings.module.scss";

export function Settings() {
  const t = useTranslations();
  const { me, projects } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const isAdmin = me.role === "admin" || me.role === "owner";

  const [theme, setTheme] = useState<"dark" | "light">(
    typeof document !== "undefined"
      ? ((document.documentElement.getAttribute("data-theme") as
          | "dark"
          | "light") ?? "dark")
      : "dark",
  );
  const applyTheme = (val: "dark" | "light") => {
    setTheme(val);
    document.documentElement.setAttribute("data-theme", val);
  };

  return (
    <div className={styles.wrap}>
      <h2 className={styles.pageTitle}>{t("settings.title")}</h2>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t("settings.appearance")}</h3>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{t("settings.theme")}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>
              {t("settings.themeDesc")}
            </div>
          </div>
          <SegmentedControl
            items={[
              { value: "dark", label: t("settings.dark") },
              { value: "light", label: t("settings.light") },
            ]}
            value={theme}
            onChange={(v) => applyTheme(v as "dark" | "light")}
          />
        </div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{t("settings.language")}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>
              {t("settings.languageDesc")}
            </div>
          </div>
          <SegmentedControl
            items={[
              { value: "de", label: "Deutsch" },
              { value: "en", label: "English" },
            ]}
            value={locale}
            onChange={(v) =>
              router.replace(pathname, { locale: v as typeof locale })
            }
          />
        </div>
      </section>

      {isAdmin && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("settings.workspace")}</h3>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>
                {t("settings.workspaceName")}
              </div>
              <div className="faint" style={{ fontSize: 12.5 }}>
                —
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:pencil" width={14} />}
            >
              {t("actions.rename")}
            </Button>
          </div>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>{t("settings.projects")}</div>
              <div className="faint" style={{ fontSize: 12.5 }}>
                {t("members.activeProjects", { count: projects.length })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:plus" width={14} />}
            />
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t("settings.profile")}</h3>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{t("fields.name")}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>
              {me.name}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon icon="lucide:pencil" width={14} />}
          >
            {t("actions.edit")}
          </Button>
        </div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{t("fields.email")}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>
              {me.email}
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{t("fields.role")}</div>
            <div
              className="faint"
              style={{ fontSize: 12.5, textTransform: "capitalize" }}
            >
              {me.role}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
