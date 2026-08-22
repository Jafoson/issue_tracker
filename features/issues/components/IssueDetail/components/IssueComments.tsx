"use client";

import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ModalShortcut } from "@/components/ui/layout/Modal/components/ModalFooter";
import type { UploadedAttachment } from "@/components/ui/layout/RichTextEditor/RichTextEditor";
import {
  addComment,
  addIssueLinkAttachment,
  deleteComment,
  deleteIssueAttachment,
  toggleCommentReaction,
  updateComment,
} from "@/features/issues/actions";
import { useEditorSources } from "@/features/issues/components/IssueRichText/IssueRichText";
import { issuePath } from "@/features/issues/issue-links";
import type { IssueEditorData } from "@/features/issues/types";
import { uploadIssueAttachment } from "@/features/issues/uploadAttachment";
import { emptyDoc, isEmptyDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";
import type { Comment, User } from "@/types";
import styles from "../issueDetail.module.scss";
import { CommentThread } from "./CommentThread";

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
  issueId: string;
  /** Für den kopierbaren Link auf einen einzelnen Kommentar. */
  workspaceId: string;
  identifier: string;
  comments: Comment[];
  members: User[];
  me: User;
  /** Für die Vorschläge hinter `@` und `#`. */
  data: IssueEditorData;
  /** `issue.access.canUpdateAnyComment`/`canDeleteAnyComment`. */
  canUpdateAnyComment: boolean;
  canDeleteAnyComment: boolean;
  /** Schreibt den Kommentar; erst danach leert sich das Feld. */
  onSubmit: (body: PMDoc) => Promise<void>;
  /**
   * Holt das Issue neu — Antworten, Bearbeiten, Löschen, Reaktionen und
   * Anhänge im Kommentarfeld laufen über eigene Server Actions statt über
   * `onSubmit` (das bleibt dem Top-Level-Composer vorbehalten) und melden
   * sich darüber zurück — das Panel hängt an keinem Server-Render.
   */
  onRefresh: () => Promise<void>;
}

/** Baut aus den `issueId`-Actions dieselben drei Handler, die `RichTextEditor`
 *  erwartet — einmal für den Top-Level-Composer, einmal je Antwort- und
 *  Bearbeiten-Editor, ohne den Block dreifach auszuschreiben. */
function makeAttachmentHandlers(
  issueId: string,
  onRefresh: () => Promise<void>,
  uploadFailedLabel: string,
) {
  return {
    onUploadAttachment: async (
      file: File,
    ): Promise<UploadedAttachment | { error: string }> => {
      const result = await uploadIssueAttachment(issueId, file);
      if ("error" in result) return result;
      const { attachment } = result;
      if (!attachment.url) return { error: uploadFailedLabel };
      // Nicht abwarten: der Knoten soll sofort im Kommentarfeld erscheinen,
      // die Anhänge-Sektion zieht kurz danach nach.
      onRefresh();
      return {
        id: attachment.id,
        url: attachment.url,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
      };
    },
    onRemoveAttachment: async (id: string) => {
      const result = await deleteIssueAttachment(issueId, id);
      if ("error" in result) throw new Error(result.error);
      onRefresh();
    },
    onAddLinkAttachment: async (input: {
      url: string;
      name?: string;
      mimeType?: string | null;
    }): Promise<UploadedAttachment | { error: string }> => {
      const result = await addIssueLinkAttachment(issueId, input);
      if ("error" in result) return result;
      const { attachment } = result;
      if (!attachment.url) return { error: uploadFailedLabel };
      onRefresh();
      return {
        id: attachment.id,
        url: attachment.url,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
      };
    },
  };
}

export function IssueComments({
  issueId,
  workspaceId,
  identifier,
  comments,
  members,
  me,
  data,
  canUpdateAnyComment,
  canDeleteAnyComment,
  onSubmit,
  onRefresh,
}: IssueCommentsProps) {
  const t = useTranslations();
  const sources = useEditorSources(data);
  const searchParams = useSearchParams();
  const [body, setBody] = useState<PMDoc>(emptyDoc);
  const [isSending, setIsSending] = useState(false);
  // Zählt bei jedem gesendeten Kommentar hoch und setzt den Editor darüber neu
  // auf. Ohne das behielte ProseMirror seinen alten Inhalt — `value` ist für
  // ihn nur der Startwert.
  const [round, setRound] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Merkt sich, zu welchem Kommentar schon gesprungen wurde — `comments`
  // ändert sich nach jedem `onRefresh()` (neue Referenz), ohne den Merker
  // sprängen wir bei jeder Folgeaktion (z.B. einer Reaktion) erneut hin.
  const scrolledTo = useRef<string | null>(null);

  const isEmpty = isEmptyDoc(body);
  const attachmentHandlers = makeAttachmentHandlers(
    issueId,
    onRefresh,
    t("editor.attachmentUploadFailed"),
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Comment[]>();
    for (const c of comments) {
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }, [comments]);
  const topLevel = childrenByParent.get(null) ?? [];

  const highlightId = searchParams.get("comment");
  useEffect(() => {
    // `comments` erscheint nicht im Effekt-Körper, löst aber trotzdem einen
    // erneuten Versuch aus: das Ziel kann bei der ersten Runde noch fehlen,
    // wenn `onRefresh()` nach einer Antwort/Bearbeitung eine neue Liste
    // bringt, in der es jetzt steht.
    void comments;
    if (!highlightId || scrolledTo.current === highlightId) return;
    const el = document.getElementById(`comment-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    scrolledTo.current = highlightId;
    setFlashId(highlightId);
    const timeout = setTimeout(() => setFlashId(null), 2000);
    return () => clearTimeout(timeout);
  }, [highlightId, comments]);

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

  const editComment = async (commentId: string, value: PMDoc) => {
    await updateComment(commentId, value);
    await onRefresh();
  };

  const removeComment = (commentId: string) => {
    // Kein Bestätigungsdialog — dieselbe Konvention wie „Aufgabe löschen"
    // (`IssueDetailActions.tsx`): sofort, ohne Umweg.
    deleteComment(commentId).then(onRefresh);
  };

  const replyToComment = async (parentId: string, value: PMDoc) => {
    await addComment(issueId, value, me.id, parentId);
    await onRefresh();
  };

  const toggleReaction = (commentId: string, emoji: string) => {
    toggleCommentReaction(commentId, emoji).then(onRefresh);
  };

  const copyLink = (commentId: string) => {
    const url = `${window.location.origin}${issuePath(workspaceId, identifier)}?comment=${commentId}`;
    navigator.clipboard.writeText(url).catch(() => {
      // Ohne Berechtigung oder über eine unsichere Verbindung gibt es keine
      // Zwischenablage — dann passiert eben nichts.
    });
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
          {topLevel.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              depth={0}
              childrenByParent={childrenByParent}
              members={members}
              me={me}
              data={data}
              canUpdateAnyComment={canUpdateAnyComment}
              canDeleteAnyComment={canDeleteAnyComment}
              flashId={flashId}
              attachmentHandlers={attachmentHandlers}
              onEdit={editComment}
              onDelete={removeComment}
              onReply={replyToComment}
              onToggleReaction={toggleReaction}
              onCopyLink={copyLink}
            />
          ))}
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
            {...attachmentHandlers}
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
