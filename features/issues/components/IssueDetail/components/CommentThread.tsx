"use client";

import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import type { ReactionSummary } from "@/components/ui/atoms/ReactionBar/ReactionBar";
import { ReactionBar } from "@/components/ui/atoms/ReactionBar/ReactionBar";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import type { UploadedAttachment } from "@/components/ui/layout/RichTextEditor/RichTextEditor";
import {
  IssueRichText,
  useEditorSources,
} from "@/features/issues/components/IssueRichText/IssueRichText";
import type { IssueEditorData } from "@/features/issues/types";
import { emptyDoc, isEmptyDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";
import { fullName } from "@/lib/utils/string";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import type { Comment, User } from "@/types";
import styles from "../issueDetail.module.scss";

const RichTextEditor = dynamic(
  () =>
    import("@/components/ui/layout/RichTextEditor/RichTextEditor").then(
      (m) => m.RichTextEditor,
    ),
  { ssr: false, loading: () => <div className={styles.composerLoading} /> },
);

/** Ab dieser Tiefe wächst der Einzug nicht mehr weiter — sonst läuft ein
 *  langer Rückfrage-Rückfrage-Thread irgendwann aus der Spalte heraus. Es
 *  wird trotzdem immer exakt auf den angeklickten Kommentar geantwortet,
 *  unabhängig vom sichtbaren Deckel. */
const MAX_INDENT_DEPTH = 4;
const INDENT_PX = 22;

interface AttachmentHandlers {
  onUploadAttachment: (
    file: File,
  ) => Promise<UploadedAttachment | { error: string }>;
  onRemoveAttachment: (id: string) => Promise<void>;
  onAddLinkAttachment: (input: {
    url: string;
    name?: string;
    mimeType?: string | null;
  }) => Promise<UploadedAttachment | { error: string }>;
}

interface CommentThreadProps {
  comment: Comment;
  depth: number;
  childrenByParent: Map<string | null, Comment[]>;
  members: User[];
  me: User;
  data: IssueEditorData;
  /** `comment.update.any` — fremde Kommentare bearbeiten, nicht nur eigene. */
  canUpdateAnyComment: boolean;
  /** `comment.delete.any` — fremde Kommentare löschen, nicht nur eigene. */
  canDeleteAnyComment: boolean;
  /** Kurz hervorgehoben nach einem Sprung über „Link kopieren". */
  flashId: string | null;
  attachmentHandlers: AttachmentHandlers;
  onEdit: (commentId: string, body: PMDoc) => Promise<void>;
  onDelete: (commentId: string) => void;
  onReply: (parentId: string, body: PMDoc) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: string) => void;
  onCopyLink: (commentId: string) => void;
}

/**
 * Ein Kommentar samt seiner Antworten, rekursiv. Kebab-Menü, Bearbeiten-Modus
 * und der eingebettete Antwort-Composer sind lokaler Zustand dieser einen
 * Instanz — die eigentlichen Server-Aufrufe (inklusive `onRefresh`) sitzen
 * bei `IssueComments.tsx`, hier kommen sie nur als Callback herein.
 */
export function CommentThread({
  comment,
  depth,
  childrenByParent,
  members,
  me,
  data,
  canUpdateAnyComment,
  canDeleteAnyComment,
  flashId,
  attachmentHandlers,
  onEdit,
  onDelete,
  onReply,
  onToggleReaction,
  onCopyLink,
}: CommentThreadProps) {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const sources = useEditorSources(data);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState<PMDoc>(emptyDoc);
  const [isSending, setIsSending] = useState(false);

  const author = members.find((m) => m.id === comment.author) ?? null;
  const isOwn = comment.author === me.id;
  const canEdit = isOwn || canUpdateAnyComment;
  const canDelete = isOwn || canDeleteAnyComment;
  const replies = childrenByParent.get(comment.id) ?? [];
  const indent = Math.min(depth, MAX_INDENT_DEPTH) * INDENT_PX;

  const reactions: ReactionSummary[] = comment.reactions;

  const menuItems = [
    ...(canEdit
      ? [
          {
            value: "edit",
            label: t("actions.edit"),
            icon: <Icon icon="lucide:pencil" width={15} />,
          },
        ]
      : []),
    {
      value: "reply",
      label: t("comments.reply"),
      icon: <Icon icon="lucide:reply" width={15} />,
    },
    {
      value: "copyLink",
      label: t("actions.copyLink"),
      icon: <Icon icon="lucide:link" width={15} />,
    },
    ...(canDelete
      ? [
          {
            value: "delete",
            label: t("actions.delete"),
            icon: <Icon icon="lucide:trash-2" width={15} />,
          },
        ]
      : []),
  ];

  const submitReply = async () => {
    if (isEmptyDoc(replyBody) || isSending) return;
    setIsSending(true);
    try {
      await onReply(comment.id, replyBody);
      setReplyBody(emptyDoc());
      setIsReplying(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <li
      id={`comment-${comment.id}`}
      className={styles.comment}
      data-flash={flashId === comment.id ? "" : undefined}
      style={indent ? { marginLeft: indent } : undefined}
    >
      <Avatar avatar={author} size={28} placeholder />
      <div className={styles.commentBody}>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>
            {author ? fullName(author) : "—"}
          </span>
          <span className={styles.commentTime}>{timeAgo(comment.time)}</span>
          {comment.updated && (
            <span className={styles.commentEdited}>{t("comments.edited")}</span>
          )}

          <InlinePicker
            width={190}
            align="end"
            stop
            trigger={
              <button
                type="button"
                className={styles.commentMenuTrigger}
                aria-label={t("actions.moreActions")}
                title={t("actions.moreActions")}
              >
                <Icon icon="lucide:more-horizontal" width={15} />
              </button>
            }
          >
            {(close) => (
              <SelectMenu
                items={menuItems}
                value={null}
                onPick={(value) => {
                  close();
                  if (value === "edit") setIsEditing(true);
                  else if (value === "reply") setIsReplying(true);
                  else if (value === "copyLink") onCopyLink(comment.id);
                  else if (value === "delete") onDelete(comment.id);
                }}
                onClose={close}
              />
            )}
          </InlinePicker>
        </div>

        <IssueRichText
          className={styles.commentText}
          value={comment.body}
          data={data}
          label={t("fields.description")}
          saveLabel={t("actions.save")}
          cancelLabel={t("actions.cancel")}
          editing={isEditing}
          onEditingChange={setIsEditing}
          onCommit={(value) => onEdit(comment.id, value)}
          {...attachmentHandlers}
        />

        <ReactionBar
          reactions={reactions}
          onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
          addLabel={t("comments.addReaction")}
          searchPlaceholder={t("comments.reactionSearchPlaceholder")}
        />

        {isReplying && (
          <div className={styles.reply}>
            <Avatar avatar={me} size={24} />
            <div className={styles.composerBox}>
              <RichTextEditor
                value={replyBody}
                onChange={setReplyBody}
                onSubmit={submitReply}
                label={t("comments.replyPlaceholder")}
                placeholder={t("comments.replyPlaceholder")}
                autoFocus
                members={sources.members}
                issues={sources.issues}
                {...attachmentHandlers}
              />
              <div className={styles.composerFoot}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReplying(false)}
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isEmptyDoc(replyBody) || isSending}
                  onClick={submitReply}
                >
                  {t("comments.reply")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <ol className={styles.replies}>
            {replies.map((reply) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                depth={depth + 1}
                childrenByParent={childrenByParent}
                members={members}
                me={me}
                data={data}
                canUpdateAnyComment={canUpdateAnyComment}
                canDeleteAnyComment={canDeleteAnyComment}
                flashId={flashId}
                attachmentHandlers={attachmentHandlers}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                onToggleReaction={onToggleReaction}
                onCopyLink={onCopyLink}
              />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}
