import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  createInvitation,
  invitationPath,
  invitationUrl,
  newInvitationToken,
  openInvitation,
} from "@/lib/invitations";

// ── A fake client that can only do what these functions need ──────────────────

const deleteMany = mock();
const create = mock();
const findUnique = mock();

// biome-ignore lint/suspicious/noExplicitAny: test double for the Prisma client
const db = { invitation: { deleteMany, create, findUnique } } as any;

const NOW = new Date("2026-08-04T12:00:00Z");

function reset() {
  for (const m of [deleteMany, create, findUnique]) m.mockReset();
  deleteMany.mockResolvedValue({ count: 0 });
  create.mockResolvedValue({});
}

/** An open invitation, as delivered by the database. */
function row(
  overrides: {
    expires?: Date;
    acceptedAt?: Date | null;
    suspended?: boolean;
    hasPasskey?: boolean;
    projectId?: string | null;
  } = {},
) {
  return {
    token: "tok",
    workspaceId: "acme",
    projectId: overrides.projectId ?? null,
    expires: overrides.expires ?? new Date("2026-08-18T12:00:00Z"),
    acceptedAt: overrides.acceptedAt ?? null,
    workspace: { name: "Acme", suspended: overrides.suspended ?? false },
    user: {
      id: "u-1",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "",
      authenticators: overrides.hasPasskey ? [{ credentialID: "cred-1" }] : [],
    },
  };
}

describe("newInvitationToken()", () => {
  it("is long and URL-safe", () => {
    const token = newInvitationToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("doesn't repeat itself", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => newInvitationToken()),
    );
    expect(tokens.size).toBe(200);
  });
});

describe("createInvitation()", () => {
  beforeEach(reset);

  it("discards the previous open invitation for the same person", async () => {
    await createInvitation(db, { userId: "u-1", workspaceId: "acme" }, NOW);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "u-1", workspaceId: "acme", acceptedAt: null },
    });
  });

  it("sets a 14-day deadline", async () => {
    await createInvitation(db, { userId: "u-1", workspaceId: "acme" }, NOW);
    const { data } = create.mock.calls[0][0];
    expect(data.expires).toEqual(new Date("2026-08-18T12:00:00Z"));
  });

  it("remembers the inviting project", async () => {
    await createInvitation(
      db,
      { userId: "u-1", workspaceId: "acme", projectId: "p-1" },
      NOW,
    );
    expect(create.mock.calls[0][0].data.projectId).toBe("p-1");
  });

  it("returns the token and deadline as they were written", async () => {
    const result = await createInvitation(
      db,
      { userId: "u-1", workspaceId: "acme" },
      NOW,
    );
    expect(create.mock.calls[0][0].data.token).toBe(result.token);
    expect(result.expiresAt).toEqual(new Date("2026-08-18T12:00:00Z"));
  });
});

describe("invitationUrl()", () => {
  it("appends the path to the base URL", () => {
    expect(invitationUrl("tok")).toEndWith(invitationPath("tok"));
  });

  it("is absolute — the link gets copied and opened elsewhere", () => {
    expect(invitationUrl("tok")).toMatch(/^https?:\/\//);
  });
});

describe("openInvitation()", () => {
  beforeEach(reset);

  it("returns the invitation along with the workspace name", async () => {
    findUnique.mockResolvedValue(row());
    const invitation = await openInvitation(db, "tok", NOW);
    expect(invitation).toMatchObject({
      token: "tok",
      workspaceId: "acme",
      workspaceName: "Acme",
      email: "ada@example.com",
      hasPasskey: false,
    });
  });

  it("reports an account with a passkey — that no longer needs an invitation", async () => {
    findUnique.mockResolvedValue(row({ hasPasskey: true }));
    expect((await openInvitation(db, "tok", NOW))?.hasPasskey).toBe(true);
  });

  // Unknown, expired, used, suspended: all four end the same way, so the
  // endpoint isn't an oracle for valid tokens.
  it("returns null for an unknown token", async () => {
    findUnique.mockResolvedValue(null);
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });

  it("returns null for an empty token, without asking the database", async () => {
    expect(await openInvitation(db, "", NOW)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an expired invitation", async () => {
    findUnique.mockResolvedValue(row({ expires: new Date("2026-08-01") }));
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });

  it("returns null for an invitation that was already accepted", async () => {
    findUnique.mockResolvedValue(row({ acceptedAt: new Date("2026-08-02") }));
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });

  it("returns null when the workspace is suspended", async () => {
    findUnique.mockResolvedValue(row({ suspended: true }));
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });
});
