"use client";

import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import type { ReactionSummary } from "@/components/ui/atoms/ReactionBar/ReactionBar";
import { ReactionBar } from "@/components/ui/atoms/ReactionBar/ReactionBar";
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
 *  unabhängig vom sichtbaren Deckel.
 *
 *  Reines CSS reicht dafür nicht: jede Ebene bringt über `.comment` (Avatar +
 *  Inhalt als Flex-Row) ihren eigenen Versatz mit, unabhängig vom Padding des
 *  umgebenden `<ol>`. Ab dieser Tiefe wird deshalb der komplette Nachfahren-
 *  Baum (nicht nur die direkten Antworten) mit `collectDescendants` in eine
 *  einzige flache Geschwister-Liste aufgelöst — jeder Kommentar behält seine
 *  echten Handler (Antworten landen weiter beim tatsächlich angeklickten
 *  Elternkommentar), rendert aber selbst keine weitere Verschachtelung mehr
 *  (`skipOwnReplies`). */
const MAX_INDENT_DEPTH = 3;

/** Horizontaler Versatz, den eine Verschachtelungsebene insgesamt mitbringt:
 *  20px Padding + 2px Rand von `.replies`, plus 28px Avatar + 12px Lücke von
 *  `.comment`. Zieht den Antwort-Editor unten um `depth * diesen Wert` nach
 *  links, damit das Eingabefeld selbst nicht mit einrückt — bei Änderungen an
 *  diesen Maßen in der SCSS-Datei muss der Wert hier mitgepflegt werden. */
const REPLY_COMPOSER_INDENT_PER_LEVEL = 20 + 2 + 28 + 12;

/** Ein Kommentar in der geflatteten Liste, zusammen mit der ID des direkten
 *  Kindes, aus dessen Ast er stammt (`branchId`) — verschiedene Äste, die
 *  jenseits von `MAX_INDENT_DEPTH` als Geschwister nebeneinander landen,
 *  bekommen so eine Trennlinie zwischen sich (siehe `.branchDivider`). */
interface FlatReply {
  comment: Comment;
  branchId: string;
}

/** Löst den kompletten Nachfahren-Baum eines Kommentars in Baum-Reihenfolge
 *  (Vorordnung) auf — genutzt, um ihn jenseits von `MAX_INDENT_DEPTH` als
 *  eine einzige flache Liste zu rendern. */
function collectDescendants(
  parentId: string,
  childrenByParent: Map<string | null, Comment[]>,
): FlatReply[] {
  const direct = childrenByParent.get(parentId) ?? [];
  return direct.flatMap((child) =>
    tagBranch(child, child.id, childrenByParent),
  );
}

function tagBranch(
  comment: Comment,
  branchId: string,
  childrenByParent: Map<string | null, Comment[]>,
): FlatReply[] {
  const children = childrenByParent.get(comment.id) ?? [];
  return [
    { comment, branchId },
    ...children.flatMap((child) =>
      tagBranch(child, branchId, childrenByParent),
    ),
  ];
}

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
  /** Ihre eigenen Nachfahren sind bereits als flache Geschwister von einem
   *  Vorfahren jenseits von `MAX_INDENT_DEPTH` gerendert (`collectDescendants`)
   *  — diese Instanz rendert deshalb keine eigene Antworten-Liste mehr. */
  skipOwnReplies?: boolean;
  childrenByParent: Map<string | null, Comment[]>;
  /** Für die Auflösung des tatsächlichen Elternkommentars jenseits von
   *  `MAX_INDENT_DEPTH` — der Einzug verrät es dort nicht mehr. */
  commentsById: Map<string, Comment>;
  /** IDs aller Vorfahren des per `?comment=`-Link verlinkten Kommentars —
   *  steht diese Instanz darin, klappt sie ihre Antworten initial auf, sonst
   *  fände `scrollIntoView` in `IssueComments.tsx` das Ziel nicht im DOM. */
  highlightAncestorIds: Set<string>;
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
  skipOwnReplies = false,
  childrenByParent,
  commentsById,
  highlightAncestorIds,
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
  // Antworten sind standardmäßig eingeklappt — sie werden erst beim Aufklappen
  // gerendert, damit ein langer Thread nicht komplett auf einmal lädt. Liegt
  // der per Link angesprungene Kommentar in diesem Ast, klappt er trotzdem
  // gleich auf (siehe `highlightAncestorIds`).
  const [repliesCollapsed, setRepliesCollapsed] = useState(
    () => !highlightAncestorIds.has(comment.id),
  );

  const author = members.find((m) => m.id === comment.author) ?? null;
  const isOwn = comment.author === me.id;
  const canEdit = isOwn || canUpdateAnyComment;
  const canDelete = isOwn || canDeleteAnyComment;

  // Jenseits von MAX_INDENT_DEPTH werden nicht nur die direkten Antworten,
  // sondern der komplette Nachfahren-Baum als eine flache Geschwister-Liste
  // gerendert (s. Kommentar bei MAX_INDENT_DEPTH) — die Kinder rendern dann
  // selbst nichts mehr (`skipOwnReplies`).
  const flattensChildren = !skipOwnReplies && depth + 1 > MAX_INDENT_DEPTH;
  const flatEntries = flattensChildren
    ? collectDescendants(comment.id, childrenByParent)
    : null;
  const visibleReplies = skipOwnReplies
    ? []
    : (flatEntries?.map((entry) => entry.comment) ??
      childrenByParent.get(comment.id) ??
      []);

  const reactions: ReactionSummary[] = comment.reactions;

  // Ab MAX_INDENT_DEPTH rückt dieser Kommentar visuell nicht mehr weiter ein
  // — statt des fehlenden Einzugs zeigt „Antwort auf …" explizit den
  // tatsächlichen Elternkommentar, weil dort mehrere ehemals verschachtelte
  // Äste als Geschwister nebeneinander landen und der bloße Listenkontext
  // (nur der Verzweigungsstrich aus `.replies`) nicht mehr verrät, wer auf
  // wen antwortet.
  const isFlattened = depth > MAX_INDENT_DEPTH;
  const parentComment =
    isFlattened && comment.parentId
      ? (commentsById.get(comment.parentId) ?? null)
      : null;
  const parentAuthor = parentComment
    ? (members.find((m) => m.id === parentComment.author) ?? null)
    : null;

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
    >
      <Avatar avatar={author} size={28} placeholder />
      <div className={styles.commentBody}>
        {parentComment && (
          <a
            href={`#comment-${parentComment.id}`}
            className={styles.nestedReplyLink}
          >
            <Icon
              icon="lucide:corner-down-right"
              width={13}
              aria-hidden="true"
            />
            {t("comments.replyingTo", {
              name: parentAuthor ? fullName(parentAuthor) : "—",
            })}
          </a>
        )}

        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>
            {author ? fullName(author) : "—"}
          </span>
          <span className={styles.commentTime}>{timeAgo(comment.time)}</span>
          {comment.updated && (
            <span className={styles.commentEdited}>{t("comments.edited")}</span>
          )}
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

        <div className={styles.commentActions}>
          <ReactionBar
            reactions={reactions}
            onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
            addLabel={t("comments.addReaction")}
            searchPlaceholder={t("comments.reactionSearchPlaceholder")}
          />

          <div className={styles.commentActionButtons}>
            {canEdit && (
              <button
                type="button"
                className={styles.commentActionButton}
                aria-label={t("actions.edit")}
                title={t("actions.edit")}
                onClick={() => setIsEditing(true)}
              >
                <Icon icon="lucide:pencil" width={14} />
              </button>
            )}
            <button
              type="button"
              className={styles.commentActionButton}
              aria-label={t("comments.reply")}
              title={t("comments.reply")}
              onClick={() => setIsReplying(true)}
            >
              <Icon icon="lucide:reply" width={14} />
            </button>
            <button
              type="button"
              className={styles.commentActionButton}
              aria-label={t("actions.copyLink")}
              title={t("actions.copyLink")}
              onClick={() => onCopyLink(comment.id)}
            >
              <Icon icon="lucide:link" width={14} />
            </button>
            {canDelete && (
              <button
                type="button"
                className={styles.commentActionButton}
                aria-label={t("actions.delete")}
                title={t("actions.delete")}
                onClick={() => onDelete(comment.id)}
              >
                <Icon icon="lucide:trash-2" width={14} />
              </button>
            )}
          </div>
        </div>

        {isReplying && (
          <div
            className={styles.reply}
            style={
              depth > 0
                ? { marginLeft: -(depth * REPLY_COMPOSER_INDENT_PER_LEVEL) }
                : undefined
            }
          >
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
        )}

        {visibleReplies.length > 0 && (
          <button
            type="button"
            className={styles.repliesToggle}
            onClick={() => setRepliesCollapsed((v) => !v)}
            aria-expanded={!repliesCollapsed}
          >
            <Icon
              icon={
                repliesCollapsed
                  ? "lucide:chevron-right"
                  : "lucide:chevron-down"
              }
              width={14}
              aria-hidden="true"
            />
            {t(
              repliesCollapsed
                ? "comments.showReplies"
                : "comments.hideReplies",
              { count: visibleReplies.length },
            )}
          </button>
        )}

        {visibleReplies.length > 0 && !repliesCollapsed && (
          <ol className={styles.replies}>
            {visibleReplies.map((reply, index) => {
              // Zwei ehemals getrennte Äste landen hier als Geschwister
              // nebeneinander — eine Trennlinie markiert, wo einer endet und
              // der nächste (neue Antwortzweig) beginnt.
              const isNewBranch =
                !!flatEntries &&
                index > 0 &&
                flatEntries[index].branchId !== flatEntries[index - 1].branchId;
              return (
                <Fragment key={reply.id}>
                  {isNewBranch && (
                    <li className={styles.branchDivider} aria-hidden="true" />
                  )}
                  <CommentThread
                    comment={reply}
                    depth={flattensChildren ? MAX_INDENT_DEPTH + 1 : depth + 1}
                    skipOwnReplies={flattensChildren}
                    childrenByParent={childrenByParent}
                    commentsById={commentsById}
                    highlightAncestorIds={highlightAncestorIds}
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
                </Fragment>
              );
            })}
          </ol>
        )}
      </div>
    </li>
  );
}
