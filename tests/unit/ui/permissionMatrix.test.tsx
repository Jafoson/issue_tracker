import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// Geprüft wird das Raster: welche Spalte welchen Zustand zeigt und wo geklickt
// werden darf. Übersetzungen und Icons sind dafür Rauschen.

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

/** Die Zelle einer Zeile — die Reihenfolge der `td` ist die der Rollen. */
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
    // Kopfzeile: genau eine Spalte je Rolle.
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
    // Es gibt kein drittes „ausdrücklich verboten" mehr: nicht aufgeführt ist
    // bereits das Verbot, weil im Kontext nur diese eine Rolle zählt.
    const html = render([role({ id: "admin", grants: ["issue.create"] })]);

    const [granted] = cells(html, "issue.create");
    const [notGranted] = cells(html, "comment.create");
    expect(granted).toContain('role="switch"');
    expect(granted).toContain('aria-checked="true"');
    expect(notGranted).toContain('aria-checked="false"');
  });

  it("sperrt den Schalter, wo der Handelnde das Recht selbst nicht hat", () => {
    // Wegnehmen bleibt möglich — das vergrößert niemandes Rechte.
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

    // Ein Abschnitt für `issue.*`, einer für `comment.*` — nicht drei.
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
    // Der Zustand der Zelle bleibt daneben lesbar — offen heißt nicht unklar.
    expect(admin).toContain("data-granted");
  });

  it("zählt auch Änderungen an ausgeblendeten Spalten mit", () => {
    // `changed` beschreibt den ganzen Stapel, `roles` nur die sichtbaren
    // Spalten. Beim Speichern ginge die versteckte trotzdem mit.
    const html = render([role({ id: "admin" })], {
      changed: new Set([
        cellId("admin", "issue.create"),
        cellId("hidden-role", "comment.create"),
      ]),
    });

    expect(html).toContain("roles.unsavedCount");
  });
});
