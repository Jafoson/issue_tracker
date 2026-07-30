"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ModalShortcut } from "@/components/ui/layout/Modal/components/ModalFooter";
import { fullName } from "@/lib/utils/string";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import type { Comment, User } from "@/types";
import styles from "../issueDetail.module.scss";

interface IssueCommentsProps {
  comments: Comment[];
  members: User[];
  me: User;
  /** Schreibt den Kommentar; erst danach leert sich das Feld. */
  onSubmit: (body: string) => Promise<void>;
}

/** Kommentarverlauf eines Issues samt Eingabefeld. */
export function IssueComments({
  comments,
  members,
  me,
  onSubmit,
}: IssueCommentsProps) {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const submit = async () => {
    const text = body.trim();
    if (!text || isSending) return;
    setIsSending(true);
    try {
      await onSubmit(text);
      setBody("");
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
                  <p className={styles.commentText}>{comment.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form className={styles.composer} action={submit}>
        <Avatar avatar={me} size={28} />
        <div className={styles.composerBox}>
          <textarea
            className={styles.textarea}
            placeholder={t("placeholders.addComment")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            // ⌘/Strg + Enter sendet, damit Absätze weiter mit Enter gehen.
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                e.currentTarget.form?.requestSubmit();
            }}
            rows={3}
          />
          <div className={styles.composerFoot}>
            <ModalShortcut keys={["⌘", "↵"]}>
              {t("comments.toSend")}
            </ModalShortcut>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!body.trim() || isSending}
            >
              {t("actions.comment")}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
