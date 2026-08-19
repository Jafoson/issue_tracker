import { beforeEach, describe, expect, it, mock } from "bun:test";

// `@/lib/project-membership` bleibt bewusst ungemockt: `projectMembership.test.ts`
// und `projectMembers.test.ts` laufen im selben Prozess (siehe CLAUDE.md) und
// verlassen sich auf die echte `enrollInWorkspaceProjects` — ein Mock hier
// würde für den Rest des Prozesses gewinnen und beide falsch testen lassen.
const mockWorkspaceDomainFindUnique = mock();
const mockWorkspaceMemberCreate = mock();
const mockWorkspaceMemberFindUnique = mock();
const mockProjectFindMany = mock();
const mockProjectMemberCreateMany = mock();

const tx = {
  workspaceDomain: { findUnique: mockWorkspaceDomainFindUnique },
  workspaceMember: {
    create: mockWorkspaceMemberCreate,
    findUnique: mockWorkspaceMemberFindUnique,
  },
  project: { findMany: mockProjectFindMany },
  projectMember: { createMany: mockProjectMemberCreateMany },
  // biome-ignore lint/suspicious/noExplicitAny: Test-Double für Prisma.TransactionClient
} as any;

import { provisionNewUser } from "@/lib/user-provisioning";

describe("provisionNewUser()", () => {
  beforeEach(() => {
    for (const m of [
      mockWorkspaceDomainFindUnique,
      mockWorkspaceMemberCreate,
      mockWorkspaceMemberFindUnique,
      mockProjectFindMany,
      mockProjectMemberCreateMany,
    ]) {
      m.mockReset();
    }
    mockWorkspaceMemberCreate.mockResolvedValue({});
    // `enrollInWorkspaceProjects` läuft echt, findet hier aber nichts zum
    // Eintragen — die Mitgliedschaft selbst ist schon über
    // `workspaceMember.create` oben bewiesen.
    mockWorkspaceMemberFindUnique.mockResolvedValue(null);
    mockProjectFindMany.mockResolvedValue([]);
  });

  it("tritt automatisch bei, wenn die Domain beansprucht ist", async () => {
    mockWorkspaceDomainFindUnique.mockResolvedValue({ workspaceId: "acme" });

    await provisionNewUser(tx, { userId: "u-new", email: "new@acme.com" });

    expect(mockWorkspaceDomainFindUnique).toHaveBeenCalledWith({
      where: { domain: "acme.com" },
      select: { workspaceId: true },
    });
    expect(mockWorkspaceMemberCreate.mock.calls[0][0].data).toMatchObject({
      workspaceId: "acme",
      userId: "u-new",
      pending: false,
    });
    // Beweist, dass `enrollInWorkspaceProjects` (echt, nicht gemockt) für
    // genau diesen Workspace lief.
    expect(mockProjectFindMany).toHaveBeenCalledWith({
      where: { workspaceId: "acme", visibility: "public" },
      select: { id: true },
    });
  });

  it("lässt Konten ohne passende Domain unangetastet", async () => {
    mockWorkspaceDomainFindUnique.mockResolvedValue(null);

    await provisionNewUser(tx, { userId: "u-new", email: "new@example.com" });

    expect(mockWorkspaceMemberCreate).not.toHaveBeenCalled();
    expect(mockProjectFindMany).not.toHaveBeenCalled();
  });
});
