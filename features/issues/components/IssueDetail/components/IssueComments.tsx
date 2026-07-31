"use client";

import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { RichText } from "@/components/ui/atoms/RichText/RichText";
import { ModalShortcut } from "@/components/ui/layout/Modal/components/ModalFooter";
import { useEditorSources } from "@/features/issues/components/IssueRichText/IssueRichText";
import type { IssueEditorData } from "@/features/issues/types";
import { emptyDoc, isEmptyDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";
import { fullName } from "@/lib/utils/string";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import type { Comment, User } from "@/types";
import styles from "../issueDetail.module.scss";

/**
 * Der Kommentarverlauf samt Eingabefeld.
 *
 * Das Feld ist derselbe Editor wie bei der Beschreibung — gerade hier zahlt
 * sich das aus: eine Erwähnung gehört häufiger in einen Kommentar als in die
 * Beschreibung. Geladen wird er wie dort erst bei Bedarf.
 */

const RichTextEditor = dynamic(
  () =>
    import("@/components/ui/layout/RichTextEditor/RichTextEditor").then(
      (m) => m.RichTextEditor,
    ),
  { ssr: false, loading: () => <div className={styles.composerLoading} /> },
);

interface IssueCommentsProps {
  comments: Comment[];
  members: User[];
  me: User;
  /** Für die Vorschläge hinter `@` und `#`. */
  data: IssueEditorData;
  /** Schreibt den Kommentar; erst danach leert sich das Feld. */
  onSubmit: (body: PMDoc) => Promise<void>;
}

export function IssueComments({
  comments,
  members,
  me,
  data,
  onSubmit,
}: IssueCommentsProps) {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const sources = useEditorSources(data);
  const [body, setBody] = useState<PMDoc>(emptyDoc);
  const [isSending, setIsSending] = useState(false);
  // Zählt bei jedem gesendeten Kommentar hoch und setzt den Editor darüber neu
  // auf. Ohne das behielte ProseMirror seinen alten Inhalt — `value` ist für
  // ihn nur der Startwert.
  const [round, setRound] = useState(0);

  const isEmpty = isEmptyDoc(body);

  const submit = async () => {
    if (isEmpty || isSending) return;
    setIsSending(true);
    try {
      await onSubmit(body);
      setBody(emptyDoc());
      setRound((r) => r + 1);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className={styles.comments}>
      <header className={styles.sectionHead}>
        <Icon icon="lucide:message-square" width={15} aria-hidden="true" />
        <h3 className={styles.sectionTitle}>{t("comments.title")}</h3>
        <span className={styles.commentsCount}>{comments.length}</span>
      </header>

      {comments.length === 0 ? (
        <p className={styles.commentsEmpty}>{t("comments.empty")}</p>
      ) : (
        <ol className={styles.commentList}>
          {comments.map((comment) => {
            const author = members.find((m) => m.id === comment.author) ?? null;
            return (
              <li key={comment.id} className={styles.comment}>
                <Avatar avatar={author} size={28} placeholder />
                <div className={styles.commentBody}>
                  <div className={styles.commentMeta}>
                    <span className={styles.commentAuthor}>
                      {author ? fullName(author) : "—"}
                    </span>
                    <span className={styles.commentTime}>
                      {timeAgo(comment.time)}
                    </span>
                  </div>
                  <RichText
                    className={styles.commentText}
                    value={comment.body}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Kein `<form action=…>` mehr: der Editor ist kein Formularfeld, und
          abgeschickt wird über den Knopf oder ⌘/Strg + Enter. */}
      <div className={styles.composer}>
        <Avatar avatar={me} size={28} />
        <div className={styles.composerBox}>
          <RichTextEditor
            key={round}
            value={body}
            onChange={setBody}
            onSubmit={submit}
            label={t("fields.description")}
            placeholder={t("placeholders.addComment")}
            members={sources.members}
            issues={sources.issues}
          />
          <div className={styles.composerFoot}>
            <ModalShortcut keys={["⌘", "↵"]}>
              {t("comments.toSend")}
            </ModalShortcut>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isEmpty || isSending}
              onClick={submit}
            >
              {t("actions.comment")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
