import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// What's checked is the grid: which column shows which state and where
// clicking is allowed. Translations and icons are just noise for that.

mock.module("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <i data-icon={icon} />,
}));

mock.module("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  cellId,
  PermissionMatrix,
} from "@/features/roles/components/PermissionMatrix/PermissionMatrix";
import type { RoleView } from "@/features/roles/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PERMISSIONS = [
  { key: "issue.create", desc: "Issue erstellen" },
  { key: "issue.delete.any", desc: "Beliebige Issues löschen" },
  { key: "comment.create", desc: "Kommentar schreiben" },
];

function role(over: Partial<RoleView> & Pick<RoleView, "id">): RoleView {
  return {
    key: over.id,
    name: over.id,
    desc: "",
    rank: 2,
    system: false,
    local: false,
    grants: [],
    manageable: true,
    memberCount: 0,
    totalCarriers: 0,
    ...over,
  };
}

function render(
  roles: RoleView[],
  {
    grantable = PERMISSIONS.map((p) => p.key),
    changed = new Set<string>(),
  }: { grantable?: string[]; changed?: ReadonlySet<string> } = {},
) {
  return renderToStaticMarkup(
    <PermissionMatrix
      roles={roles}
      permissions={PERMISSIONS}
      grantable={grantable}
      changed={changed}
      saving={false}
      onChange={() => {}}
      onSave={() => {}}
      onDiscard={() => {}}
    />,
  );
}

/** The cells of a row — the order of `td` elements matches the roles. */
function cells(html: string, permissionKey: string): string[] {
  const row = html.split(`>${permissionKey}<`)[1];
  if (!row) throw new Error(`Zeile ${permissionKey} nicht gefunden`);
  return row.split("</tr>")[0].split("<td").slice(1);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PermissionMatrix", () => {
  it("stellt jede Rolle als eigene Spalte auf", () => {
    const html = render([role({ id: "admin" }), role({ id: "viewer" })]);

    expect(html).toContain("admin");
    expect(html).toContain("viewer");
    // Header row: exactly one column per role.
    expect(html.split('class="roleHead"').length - 1).toBe(2);
  });

  it("zeigt je Zelle an, ob die Rolle das Recht hat", () => {
    const html = render([
      role({ id: "admin", grants: ["issue.create"] }),
      role({ id: "viewer" }),
    ]);

    const [admin, viewer] = cells(html, "issue.create");
    expect(admin).toContain("data-granted");
    expect(viewer).not.toContain("data-granted");
  });

  it("führt die Zelle als Schalter mit zwei Zuständen", () => {
    // There's no third "explicitly denied" state anymore: not being listed
    // already is the denial, since in this context only this one role counts.
    const html = render([role({ id: "admin", grants: ["issue.create"] })]);

    const [granted] = cells(html, "issue.create");
    const [notGranted] = cells(html, "comment.create");
    expect(granted).toContain('role="switch"');
    expect(granted).toContain('aria-checked="true"');
    expect(notGranted).toContain('aria-checked="false"');
  });

  it("sperrt den Schalter, wo der Handelnde das Recht selbst nicht hat", () => {
    // Revoking stays possible — that never expands anyone's permissions.
    const html = render([role({ id: "admin", grants: ["issue.create"] })], {
      grantable: [],
    });

    const [granted] = cells(html, "issue.create");
    const [notGranted] = cells(html, "comment.create");
    expect(notGranted).toContain("disabled");
    expect(granted).not.toContain("disabled");
  });

  it("sperrt geteilte Rollen: Anzeige statt Knopf", () => {
    const html = render([
      role({ id: "member", system: true, manageable: false }),
      role({ id: "custom" }),
    ]);

    const [shared, custom] = cells(html, "issue.create");
    expect(shared).toContain("data-locked");
    expect(shared).not.toContain("<button");
    expect(custom).toContain("<button");
  });

  it("bündelt die Zeilen nach dem Objekt des Keys", () => {
    const html = render([role({ id: "admin" })]);

    // One section for `issue.*`, one for `comment.*` — not three.
    expect(html.split('class="groupHead"').length - 1).toBe(2);
    expect(html.indexOf("roles.group.issue")).toBeLessThan(
      html.indexOf("roles.group.comment"),
    );
  });

  it("beschriftet den Knopf mit Recht, Rolle und Zustand", () => {
    const html = render([
      role({ id: "admin", name: "Admin", grants: ["issue.create"] }),
    ]);
    expect(html).toContain(
      'aria-label="Issue erstellen — Admin: roles.allowed"',
    );
  });
});

describe("Offene Änderungen", () => {
  it("hält die Speicherleiste zurück, solange nichts offen ist", () => {
    const html = render([role({ id: "admin" })]);
    expect(html).not.toContain("roles.unsavedCount");
    expect(html).not.toContain("actions.save");
  });

  it("stellt Speichern und Verwerfen auf, sobald eine Zelle offen ist", () => {
    const html = render([role({ id: "admin" })], {
      changed: new Set([cellId("admin", "issue.create")]),
    });

    expect(html).toContain("roles.unsavedCount");
    expect(html).toContain("actions.save");
    expect(html).toContain("actions.discard");
  });

  it("markiert genau die Zellen, die noch nicht geschrieben sind", () => {
    const html = render(
      [role({ id: "admin", grants: ["issue.create"] }), role({ id: "viewer" })],
      { changed: new Set([cellId("admin", "issue.create")]) },
    );

    const [admin, viewer] = cells(html, "issue.create");
    expect(admin).toContain("data-changed");
    expect(viewer).not.toContain("data-changed");
    // The cell's state stays readable alongside it — pending doesn't mean unclear.
    expect(admin).toContain("data-granted");
  });

  it("zählt auch Änderungen an ausgeblendeten Spalten mit", () => {
    // `changed` describes the whole batch, `roles` only the visible columns.
    // On save, the hidden one would still go along with it.
    const html = render([role({ id: "admin" })], {
      changed: new Set([
        cellId("admin", "issue.create"),
        cellId("hidden-role", "comment.create"),
      ]),
    });

    expect(html).toContain("roles.unsavedCount");
  });
});
