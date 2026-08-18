import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RichText } from "@/components/ui/atoms/RichText/RichText";
import { getIssueByShareToken } from "@/features/issues/queries";
import styles from "./page.module.scss";

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
 * Unbekannt und deaktiviert sehen gleich aus (kein Orakel für gültige
 * Tokens, wie bei `/invite` und `/join`). Bewusst kein Assignee, keine
 * Kommentar-Eingabe, kein Link zurück in die eingeloggte App — die Seite
 * darf strukturell keine Bearbeitungs-UI anbieten können, dafür sorgt schon
 * die minimale Projektion in `getIssueByShareToken`.
 */
export default async function SharedIssuePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, token } = await params;
  const [t, issue] = await Promise.all([
    getTranslations(),
    getIssueByShareToken(token),
  ]);

  if (!issue) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <span className={styles.icon}>
            <Icon icon="lucide:link-2-off" width={26} />
          </span>
          <h1 className={styles.title}>{t("share.invalidTitle")}</h1>
          <p className={styles.text}>{t("share.invalidText")}</p>
        </div>
      </div>
    );
  }

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className={styles.page}>
      <article className={styles.article}>
        <p className={styles.breadcrumb}>
          {issue.workspaceName} / {issue.projectName}
        </p>
        <h1 className={styles.title}>{issue.title}</h1>

        <div className={styles.badges}>
          {issue.status && (
            <span
              className={styles.badge}
              style={{
                background: `${issue.status.color}26`,
                color: issue.status.color,
              }}
            >
              {issue.status.name}
            </span>
          )}
          {issue.priority && (
            <span
              className={styles.badge}
              style={{
                background: `${issue.priority.color}26`,
                color: issue.priority.color,
              }}
            >
              {issue.priority.name}
            </span>
          )}
          {issue.type && (
            <span
              className={styles.badge}
              style={{
                background: `${issue.type.color}26`,
                color: issue.type.color,
              }}
            >
              {issue.type.name}
            </span>
          )}
          {issue.labels.map((label) => (
            <span
              key={label.id}
              className={styles.badge}
              style={{ background: `${label.color}26`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>

        <RichText value={issue.description} className={styles.description} />

        <section className={styles.comments}>
          <h2 className={styles.commentsTitle}>
            {t("share.comments", { count: issue.comments.length })}
          </h2>
          {issue.comments.length === 0 ? (
            <p className={styles.commentsEmpty}>{t("share.noComments")}</p>
          ) : (
            <ol className={styles.commentList}>
              {issue.comments.map((comment) => (
                <li key={comment.id} className={styles.comment}>
                  <div className={styles.commentHead}>
                    <span className={styles.commentAuthor}>
                      {comment.authorName}
                    </span>
                    <time dateTime={comment.created.toISOString()}>
                      {dateFormat.format(comment.created)}
                    </time>
                  </div>
                  <RichText value={comment.body} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className={styles.footer}>{t("share.footer")}</p>
      </article>
    </div>
  );
}
