import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// Geprüft wird, ob der Auslöser gezeichnet wird — nicht, was er öffnet. Das Modal
// selbst ist deshalb ein Platzhalter: es zieht sonst die Server Action und damit
// Prisma in den Test.

mock.module(
  "@/features/issues/components/CreateIssueModal/CreateIssueModal",
  () => ({ CreateIssueModal: () => null }),
);

mock.module("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <i data-icon={icon} />,
}));

mock.module("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

mock.module("@/lib/context", () => ({
  useModal: () => ({ openModal: () => "" }),
}));

mock.module("@/i18n/navigation", () => ({
  usePathname: () => "/acme/project/web",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import { BoardColumn } from "@/features/issues/components/BoardColumn/BoardColumn";
import { ListGroupHeader } from "@/features/issues/components/ListView/components/ListGroupHeader";
import { NewIssueButton } from "@/features/issues/components/NewIssueButton/NewIssueButton";
import type { IssueComposerData } from "@/features/issues/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STATUS = {
  id: "backlog",
  name: "Backlog",
  short: "B",
  color: "#888",
  isColumn: true,
};

const PROJECTS = [
  {
    id: "p-1",
    name: "Web",
    slug: "web",
    prefix: "WEB",
    color: "#111",
    avatarUrl: null,
  },
  {
    id: "p-2",
    name: "App",
    slug: "app",
    prefix: "APP",
    color: "#222",
    avatarUrl: null,
  },
];

/** Composer-Daten, in denen genau die genannten Projekte anlegbar sind. */
function composer(...creatableProjectIds: string[]): IssueComposerData {
  return {
    workspaceId: "acme",
    me: {
      id: "u-1",
      firstName: "Ada",
      lastName: "L",
      email: "ada@example.com",
      color: "#111",
    },
    projects: PROJECTS,
    members: [],
    labels: [],
    statuses: [STATUS],
    priorities: [],
    searchIssues: [],
    issueTypes: [{ id: "feature", name: "Feature", color: "#111" }],
    creatableProjectIds,
  };
}

const column = (data: IssueComposerData) =>
  renderToStaticMarkup(
    <BoardColumn
      status={STATUS}
      issues={[]}
      projectId="p-1"
      lookups={{
        projects: PROJECTS,
        members: [],
        labels: [],
        issueTypes: data.issueTypes,
      }}
      composer={data}
      newIssueLabel="Neue Aufgabe"
      isOver={false}
      dragging={null}
      dragOverCard={null}
      insertAbove={false}
      onColumnDragOver={() => {}}
      onColumnDragLeave={() => {}}
      onColumnDrop={() => {}}
      onCardDragStart={() => () => {}}
      onCardDragEnd={() => {}}
      onCardDragOver={() => () => {}}
      isCardActive={() => false}
      onCardOpen={() => {}}
      onCardOpenInNewTab={() => {}}
    />,
  );

const groupHeader = (data: IssueComposerData) =>
  renderToStaticMarkup(
    <ListGroupHeader
      status={STATUS}
      count={0}
      projectId="p-1"
      composer={data}
      collapsed={false}
      onToggle={() => {}}
    />,
  );

/** Wie viele Auslöser trägt das Markup? Alle drei Stellen nutzen ein Plus-Icon. */
const plusCount = (html: string) =>
  html.split('data-icon="lucide:plus"').length - 1;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("NewIssueButton (Seitenleiste)", () => {
  it("erscheint, wenn irgendwo ein Issue entstehen darf", () => {
    const html = renderToStaticMarkup(
      <NewIssueButton data={composer("p-1")} />,
    );
    expect(plusCount(html)).toBe(1);
    expect(html).toContain("actions.newIssue");
  });

  it("verschwindet ganz, wenn nirgends etwas entstehen darf", () => {
    const html = renderToStaticMarkup(<NewIssueButton data={composer()} />);
    expect(html).toBe("");
  });

  // Der Knopf legt das Projekt der Route vor. Darf dort nichts entstehen, nimmt
  // er das erste erlaubte statt zu verschwinden.
  it("erscheint auch, wenn nur ein anderes Projekt erlaubt ist", () => {
    const html = renderToStaticMarkup(
      <NewIssueButton data={composer("p-2")} />,
    );
    expect(plusCount(html)).toBe(1);
  });
});

describe("BoardColumn", () => {
  it("zeigt Plus im Kopf und die Zeile am Ende, wenn erlaubt", () => {
    // Zwei Auslöser: das Plus im Spaltenkopf und die Karte darunter.
    expect(plusCount(column(composer("p-1")))).toBe(2);
  });

  it("zeigt beide nicht, wenn issue.create in diesem Projekt fehlt", () => {
    expect(plusCount(column(composer()))).toBe(0);
  });

  it("prüft das Projekt der Spalte, nicht irgendeines", () => {
    // p-2 ist erlaubt, die Spalte gehört aber zu p-1.
    expect(plusCount(column(composer("p-2")))).toBe(0);
  });

  it("bleibt als Spalte bestehen — nur die Auslöser fehlen", () => {
    const html = column(composer());
    expect(html).toContain("Backlog");
  });
});

describe("ListGroupHeader", () => {
  it("zeigt das Plus, wenn erlaubt", () => {
    expect(plusCount(groupHeader(composer("p-1")))).toBe(1);
  });

  it("zeigt es nicht, wenn issue.create fehlt", () => {
    expect(plusCount(groupHeader(composer()))).toBe(0);
  });

  it("behält den Gruppenkopf samt Einklapp-Pfeil", () => {
    const html = groupHeader(composer());
    expect(html).toContain("Backlog");
    expect(html).toContain('data-icon="lucide:chevron-down"');
  });
});
