import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const ACTOR = "u-actor";
const ISSUE_ID = "i1";

const mockIssueFindUnique = mock();
const mockCommentFindUnique = mock();
const mockCommentCreate = mock();
const mockCommentUpdate = mock();
const mockCommentReactionCreate = mock();
const mockCommentReactionDelete = mock();

mock.module("@/lib/db", () => ({
  db: {
    issue: { findUnique: mockIssueFindUnique },
    comment: {
      findUnique: mockCommentFindUnique,
      create: mockCommentCreate,
      update: mockCommentUpdate,
    },
    commentReaction: {
      create: mockCommentReactionCreate,
      delete: mockCommentReactionDelete,
    },
  },
}));

const mockRequirePermission = mock(async () => ACTOR);
const mockRequirePermissionOr = mock(async () => ACTOR);
class MockPermissionError extends Error {}
mock.module("@/lib/permissions", () => ({
  requirePermission: mockRequirePermission,
  requirePermissionOr: mockRequirePermissionOr,
  PermissionError: MockPermissionError,
}));

// Nicht der echte `notify()` — der bräuchte `db.userPreferences`, das der
// `@/lib/db`-Mock oben nicht kennt. Getestet wird hier nur, *wer* für eine
// Antwort benachrichtigt wird (`commentReply` an den Elternautor statt der
// generischen `comment`-Zeile), nicht der Versand selbst — dafür gibt es
// `tests/unit/notifications/notify.test.ts`, in einem eigenen Prozess.
const mockNotify = mock();
mock.module("@/lib/notify", () => ({ notify: mockNotify }));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  addComment,
  toggleCommentReaction,
  updateComment,
} from "@/features/issues/actions";
import { Prisma } from "@/lib/generated/prisma/client";
import { emptyDoc } from "@/lib/richtext/doc";

/** Der Stand eines Issues, wie `addComment` ihn für Empfänger/Kontext liest.
 *  Reporter = Actor und kein Assignee, damit kein `notify()`-Aufruf entsteht
 *  — dessen eigenes Verhalten hat seine eigene Testdatei. */
function issueRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    projectId: "p1",
    assigneeId: null,
    reporterId: ACTOR,
    project: { workspaceId: "ws1" },
    ...overrides,
  };
}

function reset() {
  for (const m of [
    mockIssueFindUnique,
    mockCommentFindUnique,
    mockCommentCreate,
    mockCommentUpdate,
    mockCommentReactionCreate,
    mockCommentReactionDelete,
    mockRequirePermission,
    mockRequirePermissionOr,
    mockNotify,
  ]) {
    m.mockReset();
  }
  mockIssueFindUnique.mockResolvedValue(issueRow());
  mockRequirePermission.mockResolvedValue(ACTOR);
  mockRequirePermissionOr.mockResolvedValue(ACTOR);
  mockCommentCreate.mockResolvedValue({});
}

describe("addComment() — Antworten", () => {
  beforeEach(reset);

  it("setzt parentId, wenn der Elternkommentar zum selben Issue gehört", async () => {
    mockCommentFindUnique.mockResolvedValue({ issueId: ISSUE_ID });

    await addComment(ISSUE_ID, emptyDoc(), ACTOR, "c-parent");

    expect(mockCommentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issueId: ISSUE_ID,
        authorId: ACTOR,
        parentId: "c-parent",
      }),
    });
  });

  it("lehnt eine Antwort auf einen Kommentar eines anderen Issues ab", async () => {
    mockCommentFindUnique.mockResolvedValue({ issueId: "i-other" });

    await expect(
      addComment(ISSUE_ID, emptyDoc(), ACTOR, "c-parent"),
    ).rejects.toThrow();
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn der angegebene Elternkommentar gar nicht existiert", async () => {
    mockCommentFindUnique.mockResolvedValue(null);

    await expect(
      addComment(ISSUE_ID, emptyDoc(), ACTOR, "c-missing"),
    ).rejects.toThrow();
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });

  it("lässt parentId weg, wenn keins übergeben wird (Top-Level)", async () => {
    await addComment(ISSUE_ID, emptyDoc(), ACTOR);

    expect(mockCommentFindUnique).not.toHaveBeenCalled();
    expect(mockCommentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ parentId: undefined }),
    });
  });

  it("benachrichtigt den Elternautor mit `commentReply`, nicht mit `comment` — auch wenn er zufällig Bearbeiter ist", async () => {
    // Bearbeiter = Elternautor: ohne die Ausschluss-Logik in `addComment`
    // bekäme diese Person beide Benachrichtigungen für dieselbe Antwort.
    mockIssueFindUnique.mockResolvedValue(
      issueRow({ assigneeId: "u-parent-author" }),
    );
    mockCommentFindUnique.mockResolvedValue({
      issueId: ISSUE_ID,
      authorId: "u-parent-author",
    });

    await addComment(ISSUE_ID, emptyDoc(), ACTOR, "c-parent");

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-parent-author",
        type: "commentReply",
        actorId: ACTOR,
      }),
    );
    // Genau ein Aufruf: die generische "comment"-Benachrichtigung an den
    // Bearbeiter entfällt, weil er hier derselbe wie der Elternautor ist.
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it("benachrichtigt niemanden, wenn man auf den eigenen Kommentar antwortet", async () => {
    mockCommentFindUnique.mockResolvedValue({
      issueId: ISSUE_ID,
      authorId: ACTOR,
    });

    await addComment(ISSUE_ID, emptyDoc(), ACTOR, "c-parent");

    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe("updateComment() — Bearbeiten", () => {
  beforeEach(reset);

  it("prüft dieselbe Berechtigung wie deleteComment, nur für update", async () => {
    mockCommentFindUnique.mockResolvedValue({
      authorId: "u-author",
      issue: { projectId: "p1" },
    });

    await updateComment("c1", emptyDoc());

    expect(mockRequirePermissionOr).toHaveBeenCalledWith([
      { permission: "comment.update.any", ctx: { projectId: "p1" } },
      {
        permission: "comment.update.own",
        ctx: { projectId: "p1" },
        ownerIds: ["u-author"],
      },
    ]);
  });

  it("schreibt Body, abgeleiteten Text und den Bearbeitet-Zeitstempel", async () => {
    mockCommentFindUnique.mockResolvedValue({
      authorId: ACTOR,
      issue: { projectId: "p1" },
    });

    await updateComment("c1", emptyDoc());

    expect(mockCommentUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({
        updated: expect.any(Date),
      }),
    });
  });

  it("lehnt ab, wenn der Kommentar nicht existiert", async () => {
    mockCommentFindUnique.mockResolvedValue(null);

    await expect(updateComment("c-missing", emptyDoc())).rejects.toThrow();
    expect(mockCommentUpdate).not.toHaveBeenCalled();
  });
});

describe("toggleCommentReaction() — Reaktionen", () => {
  beforeEach(reset);

  it("legt eine Reaktion an, wenn noch keine existiert", async () => {
    mockCommentFindUnique.mockResolvedValue({
      issue: { projectId: "p1" },
    });
    mockCommentReactionCreate.mockResolvedValue({});

    await toggleCommentReaction("c1", "👍");

    expect(mockCommentReactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commentId: "c1",
        userId: ACTOR,
        emoji: "👍",
      }),
    });
    expect(mockCommentReactionDelete).not.toHaveBeenCalled();
  });

  it("entfernt die Reaktion wieder, wenn sie schon existiert (P2002)", async () => {
    mockCommentFindUnique.mockResolvedValue({
      issue: { projectId: "p1" },
    });
    mockCommentReactionCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    mockCommentReactionDelete.mockResolvedValue({});

    await toggleCommentReaction("c1", "👍");

    expect(mockCommentReactionDelete).toHaveBeenCalledWith({
      where: {
        commentId_userId_emoji: {
          commentId: "c1",
          userId: ACTOR,
          emoji: "👍",
        },
      },
    });
  });

  it("wirft andere Fehler unverändert weiter, statt sie als Umschalten zu lesen", async () => {
    mockCommentFindUnique.mockResolvedValue({
      issue: { projectId: "p1" },
    });
    mockCommentReactionCreate.mockRejectedValue(new Error("connection lost"));

    await expect(toggleCommentReaction("c1", "👍")).rejects.toThrow(
      "connection lost",
    );
    expect(mockCommentReactionDelete).not.toHaveBeenCalled();
  });
});
