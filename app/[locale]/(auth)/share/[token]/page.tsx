import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import { Label } from "@/components/ui/atoms/Label/Label";
import { RichText } from "@/components/ui/atoms/RichText/RichText";
import { getIssueByRef, getIssueByShareToken } from "@/features/issues/queries";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fullName } from "@/lib/utils/string";
import { CopyShareLinkButton } from "./CopyShareLinkButton";
import styles from "./page.module.scss";
import { ShareThemeShell } from "./ShareThemeShell";

export const dynamic = "force-dynamic";

type Params = { locale: string; token: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { token } = await params;
  const issue = await getIssueByShareToken(token);
  return { title: issue?.title ?? "Issue" };
}

/**
 * Ein öffentlich geteiltes Issue — nur lesend, ohne Login.
 *
 * Der Token im Pfad ist die Berechtigung — die Seite liegt deshalb in der
 * Route-Group `(auth)` und ist ohne Session erreichbar (`proxy.ts`).
 *
 * Unbekannt, deaktiviert und abgelaufen sehen gleich aus (kein Orakel für
 * gültige Tokens, wie bei `/invite` und `/join` — `getIssueByShareToken`
 * behandelt alle drei als „nicht gefunden"). Bewusst keine
 * Kommentar-Eingabe, kein Link zurück in die eingeloggte App — die Seite darf
 * strukturell keine Bearbeitungs-UI anbieten können, dafür sorgt schon die
 * minimale Projektion in `getIssueByShareToken`.
 *
 * Wer den Link mit einer Session öffnet, die für dieses Issue ohnehin schon
 * `project.view` hat, bekommt die Momentaufnahme gar nicht erst zu sehen —
 * `getIssueByRef` (dieselbe Abfrage wie die eingeloggte Detailseite, inkl.
 * ihrer eigenen Rechteprüfung) entscheidet das an Ort und Stelle, ganz ohne
 * Session hier selbst auszuwerten. Mit Bearbeitungsrecht landet die Person
 * dort folglich auch direkt in der bearbeitbaren Ansicht.
 *
 * Status/Priorität/Typ/Labels stehen nur einmal, in der Attributspalte
 * (`Label`-Atom, dieselbe Chip-Optik wie überall sonst im Produkt) — nicht
 * zusätzlich noch einmal unter dem Titel.
 *
 * Eigene, helle Optik statt des app-weiten Themes (`ShareThemeShell`) — wer
 * hier landet, ist meist noch nicht eingeloggt und kennt die dunkle
 * Standardoberfläche gar nicht.
 */
export default async function SharedIssuePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, token } = await params;
  const [t, format, issue] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getIssueByShareToken(token),
  ]);

  if (!issue) {
    return (
      <ShareThemeShell>
        <div className={styles.invalidWrap}>
          <div className={styles.card}>
            <span className={styles.icon}>
              <Icon icon="lucide:link-2-off" width={26} />
            </span>
            <h1 className={styles.title}>{t("share.invalidTitle")}</h1>
            <p className={styles.text}>{t("share.invalidText")}</p>
          </div>
        </div>
      </ShareThemeShell>
    );
  }

  const real = await getIssueByRef(issue.workspaceId, issue.identifier);
  if (real) {
    redirect({
      href: `/${issue.workspaceId}/issue/${issue.identifier}`,
      locale: locale as Locale,
    });
  }

  const now = new Date();
  const sharedByName = issue.sharedBy
    ? fullName(issue.sharedBy)
    : t("share.unknownSharer");

  return (
    <ShareThemeShell>
      <div className={styles.main}>
        <div className={styles.content}>
          {issue.sharedAt && (
            <div className={styles.banner}>
              <Avatar avatar={issue.sharedBy} size={28} placeholder />
              <p className={styles.bannerText}>
                {t("share.sharedBy", {
                  actor: sharedByName,
                  date: format.dateTime(issue.sharedAt, { dateStyle: "long" }),
                })}
              </p>
              {issue.expiresAt && (
                <span className={styles.bannerExpiry}>
                  {t("share.expiresOn", {
                    date: format.dateTime(issue.expiresAt, {
                      dateStyle: "medium",
                    }),
                  })}
                </span>
              )}
            </div>
          )}

          <div className={styles.layout}>
            <article className={styles.article}>
              <p className={styles.breadcrumb}>
                {t("share.breadcrumb", {
                  identifier: issue.identifier,
                  project: issue.projectName,
                  time: format.relativeTime(issue.createdAt, now),
                })}
              </p>
              <h1 className={styles.title}>{issue.title}</h1>

              <RichText
                value={issue.description}
                className={styles.description}
              />

              <section className={styles.comments}>
                <h2 className={styles.commentsTitle}>
                  <Icon icon="lucide:message-square" width={15} />
                  {t("share.comments", { count: issue.comments.length })}
                </h2>
                {issue.comments.length === 0 ? (
                  <p className={styles.commentsEmpty}>
                    {t("share.noComments")}
                  </p>
                ) : (
                  <ol className={styles.commentList}>
                    {issue.comments.map((comment) => (
                      <li key={comment.id} className={styles.comment}>
                        <div className={styles.commentHead}>
                          <Avatar avatar={comment.author} size={22} />
                          <span className={styles.commentAuthor}>
                            {fullName(comment.author)}
                          </span>
                          <time dateTime={comment.created.toISOString()}>
                            {format.relativeTime(comment.created, now)}
                          </time>
                        </div>
                        <RichText value={comment.body} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </article>

            <aside className={styles.sidebar}>
              <dl className={styles.metaGroup}>
                {issue.status && (
                  <div className={styles.metaRow}>
                    <dt className={styles.metaLabel}>
                      {t("share.sidebarStatus")}
                    </dt>
                    <dd className={styles.metaValue}>
                      <Label color={issue.status.color} filled size="sm">
                        {issue.status.name}
                      </Label>
                    </dd>
                  </div>
                )}
                {issue.priority && (
                  <div className={styles.metaRow}>
                    <dt className={styles.metaLabel}>
                      {t("share.sidebarPriority")}
                    </dt>
                    <dd className={styles.metaValue}>
                      <Label color={issue.priority.color} filled size="sm">
                        {issue.priority.name}
                      </Label>
                    </dd>
                  </div>
                )}
                {issue.type && (
                  <div className={styles.metaRow}>
                    <dt className={styles.metaLabel}>
                      {t("share.sidebarType")}
                    </dt>
                    <dd className={styles.metaValue}>
                      <Label color={issue.type.color} filled size="sm">
                        {issue.type.name}
                      </Label>
                    </dd>
                  </div>
                )}
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>
                    {t("share.sidebarAssignee")}
                  </dt>
                  <dd className={styles.metaValue}>
                    {issue.assignee ? (
                      <>
                        <Avatar avatar={issue.assignee} size={18} />
                        {fullName(issue.assignee)}
                      </>
                    ) : (
                      t("share.sidebarUnassigned")
                    )}
                  </dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>
                    {t("share.sidebarReporter")}
                  </dt>
                  <dd className={styles.metaValue}>
                    <Avatar avatar={issue.reporter} size={18} />
                    {fullName(issue.reporter)}
                  </dd>
                </div>
              </dl>

              {issue.labels.length > 0 && (
                <div className={styles.metaGroup}>
                  <span className={styles.metaBlockLabel}>
                    {t("share.sidebarLabels")}
                  </span>
                  <div className={styles.labelRow}>
                    {issue.labels.map((label) => (
                      <Label key={label.id} color={label.color} size="sm">
                        {label.name}
                      </Label>
                    ))}
                  </div>
                </div>
              )}

              <dl className={styles.metaGroup}>
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>
                    {t("share.sidebarCreated")}
                  </dt>
                  <dd className={styles.metaValue}>
                    {format.dateTime(issue.createdAt, { dateStyle: "medium" })}
                  </dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>
                    {t("share.sidebarUpdated")}
                  </dt>
                  <dd className={styles.metaValue}>
                    {format.relativeTime(issue.updatedAt, now)}
                  </dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>
                    {t("share.sidebarVisibility")}
                  </dt>
                  <dd className={styles.metaValue}>
                    {t("share.sidebarVisibilityPublic")}
                  </dd>
                </div>
              </dl>

              <CopyShareLinkButton
                copyLabel={t("members.inviteLinkCopy")}
                copiedLabel={t("members.inviteLinkCopied")}
              />
            </aside>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.cta}>
            <div>
              <h2 className={styles.ctaTitle}>{t("share.ctaTitle")}</h2>
              <p className={styles.ctaDesc}>
                {t("share.ctaDesc", { workspace: issue.workspaceName })}
              </p>
            </div>
            <div className={styles.ctaActions}>
              <Link
                href="/login"
                className={[
                  buttonStyles.btn,
                  buttonStyles.outline,
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
                {t("actions.requestAccess")}
              </Link>
            </div>
          </div>

          <footer className={styles.footer}>
            <span>{t("share.footerMade")}</span>
            <span className={styles.footerLinks}>
              <span>{t("share.footerPrivacy")}</span>
              <span>{t("share.footerReportAbuse")}</span>
            </span>
          </footer>
        </div>
      </div>
    </ShareThemeShell>
  );
}
