# RBAC — Rollen & Berechtigungen

Role-Based Access Control über drei Scopes. Permissions sind die atomare
Einheit, Rollen sind Bündel von Permissions, und in jedem Scope lassen sich
eigene Rollen anlegen.

---

## Das Modell in fünf Sätzen

1. Eine Rolle hat einen **Scope**: `PLATFORM`, `WORKSPACE` oder `PROJECT`.
2. Ein **Permission-Key nennt nur Objekt und Aktion** (`issue.create`,
   `label.update`). Wo er wirkt, sagt der Scope der Rolle, die ihn trägt.
3. Die **Default-Rollen liegen genau einmal in der Datenbank** und gehören
   niemandem. Alle Mandanten zeigen auf dieselben Zeilen. Selbst angelegte
   Rollen hängen am Workspace oder am Projekt.
4. Ein Benutzer hat **je Scope höchstens eine Rolle** — also bis zu drei.
   Gefragt wird immer die Ebene, um die es geht: **im Projekt entscheidet die
   Projektrolle, im Workspace die Workspace-Rolle.**
5. Darüber liegen drei implizite Regeln plus der Support-Generalschlüssel, alle
   an genau einer Stelle: `lib/permissions.ts`.

```
Workspace-Kontext:  Plattform ∪ Workspace
Projekt-Kontext:    Plattform ∪ Workspace(ohne Projektrechte) ∪ Projektrolle

erlaubt = ALLOW(zuständige Ebenen) \ ⋃ DENY(alle Ebenen)
```

Im Projekt **ersetzt** die Projektrolle also die projektbezogenen Rechte der
Workspace-Rolle, statt sie zu ergänzen. Keine Zeile in `ProjectMember` heißt
keine Projektrechte. Was allein workspaceweit gilt (`project.create`,
`project.view.all`, `team.*` …) bleibt unberührt — eine Projektrolle kann diese
Keys laut Registry gar nicht tragen.

Ein DENY sticht dagegen über alle Ebenen: eine Projektrolle hebelt kein
workspaceweites Verbot aus, sonst wäre das Verbot wertlos.

### Warum der Key seine Ebene nicht mehr nennt

Vorher gab es `workspace.label.create` **und** `project.label.create` — zwei
Keys für denselben Vorgang, unterschieden nur durch die Reichweite. Jetzt gibt es
`label.create`, und die Reichweite ergibt sich daraus, an welcher Rolle er hängt:

```
label.create in einer Workspace-Rolle → Labels im ganzen Workspace
label.create in einer Projektrolle    → Labels in diesem Projekt
```

Bei jeder Permission steht in der Registry, in welchen Scopes sie überhaupt
vergeben werden darf. `workspace.update` in einer Projektrolle wäre sinnlos und
ist gesperrt; `role.manage` gilt dagegen in allen drei Scopes und bedeutet dort
jeweils „die Rollen dieses Topfes".

### Wozu dann noch DENY?

Die Herabstufung im Projekt erledigt schon das Ersetzen — eine Projektrolle, die
`issue.update.any` nicht aufführt, gewährt es in diesem Projekt auch nicht:

```
Workspace-Rolle project_lead   ALLOW issue.update.any
Projektrolle    project_viewer (führt es nicht auf)
→ in diesem Projekt nur lesen, überall sonst voller Zugriff
```

DENY bleibt für das, was das Ersetzen nicht kann: **ein Verbot nach oben.** Es
gilt über alle Ebenen und trifft damit auch die rein workspaceweiten Rechte, an
die eine Projektrolle sonst nicht herankommt.

Dass `project_viewer`, `project_guest` und `blocked` trotzdem **erschöpfend**
verbieten, ist ein Erbe des früheren Vereinigungsmodells. Es bleibt, weil es die
Absicht ausdrücklich festhält und ein neu eingeführtes Recht für diese Rollen
automatisch sperrt — nötig für die Herabstufung ist es nicht mehr.

---

## Geteilte Default-Rollen

Die 15 System-Rollen existieren je **einmal**, ohne Eigentümer:

```
15 Rollen · 212 RolePermission-Zeilen — insgesamt, für alle Mandanten
```

Vorher bekam jeder Workspace eine eigene Kopie: 12 Rollen und 214 Grants **pro
Workspace**, bei zwei Workspaces schon 428 Zeilen mit nur 214 verschiedenen
Inhalten. Jetzt ist die Menge unabhängig von der Anzahl der Workspaces, und eine
Korrektur an `member` wirkt sofort überall statt nur in neuen Workspaces.

**Der Preis:** eine System-Rolle ist nicht editierbar — sie zu ändern träfe jeden
Mandanten. Wer „Member, aber ohne Labels" braucht, legt im eigenen Workspace eine
neue Rolle an. Im Rollen-Editor erscheinen die geteilten Rollen mit dem Vermerk
*Geteilt* und gesperrter Matrix, damit nachvollziehbar bleibt, was sie gewähren.

| `system` | `scope` | `workspaceId` | `projectId` | Bedeutung |
|---|---|---|---|---|
| `true` | (jeder) | `NULL` | `NULL` | Default-Rolle, gilt für alle |
| `false` | `PLATFORM` | `NULL` | `NULL` | eigene Plattform-Rolle |
| `false` | `WORKSPACE` | gesetzt | `NULL` | eigene Rolle dieses Workspace |
| `false` | `PROJECT` | gesetzt | `NULL` | eigene Rolle, in **allen** Projekten des Workspace |
| `false` | `PROJECT` | gesetzt | gesetzt | eigene Rolle, nur in diesem Projekt |

Ein `CHECK`-Constraint erzwingt diese Tabelle, statt sie nur zu dokumentieren.

---

## Die drei Scopes

### PLATFORM

`User.platformRoleId` → `Role` mit `scope = PLATFORM`. Steuert
Plattform-Operationen (`/admin`, Konten, Workspaces sperren).

| Rolle | Rang | Inhalt |
|---|:---:|---|
| `platform_admin` | 2 | alle Plattform-Permissions **außer** `tenant.access` |
| `platform_support` | 1 | `platform.access` + `tenant.access` |
| `platform_member` | 0 | keine — Standard für jedes Konto |

**`tenant.access` ist der Generalschlüssel** in fremde Workspaces. Er kann nur in
einer Plattform-Rolle stehen: Mandanten-Permissions sind in diesem Scope laut
Registry nicht vergebbar, es gibt also keinen feineren Weg. Wer ihn hat, bekommt
im Mandanten alles und ist von den impliziten Regeln ausgenommen — gerade wenn
ein Workspace gesperrt oder ein Projekt privat ist, muss Support hineinsehen
können. `platform_admin` hat ihn bewusst **nicht**; der Zugriff auf fremde Daten
ist damit eine sichtbare Eskalation und keine Nebenwirkung des Admin-Seins.

### WORKSPACE

`WorkspaceMember.roleId` → `Role` mit `scope = WORKSPACE`.

| Rolle | Rang | Kurz |
|---|:---:|---|
| `owner` | 6 | alles; einziger mit `workspace.delete` |
| `admin` | 5 | alles außer `workspace.delete` |
| `manager` | 4 | ohne `role.manage`, ohne `project.view.all` |
| `project_lead` | 3 | volle Projektrechte, keine Workspace-Verwaltung |
| `member` | 2 | eigene Issues, kommentieren, Labels |
| `viewer` | 1 | lesen und kommentieren |
| `guest` | 0 | wie Viewer |

Workspace-Rollen dürfen projektbezogene Permissions tragen — die gelten in
**allen** Projekten des Workspace, in denen die Person keine eigene Projektrolle
hat. Sobald sie eine hat, entscheidet diese.

### PROJECT

`ProjectMember.roleId` → `Role` mit `scope = PROJECT`.

| Rolle | Rang | ALLOW | DENY |
|---|:---:|---|---|
| `project_admin` | 4 | alles seines Scopes | — |
| `contributor` | 3 | erstellen, Eigenes ändern, kommentieren, Labels | — |
| `project_viewer` | 2 | lesen + kommentieren | alles übrige |
| `project_guest` | 1 | lesen + kommentieren | alles übrige |
| `blocked` | 0 | — | **alles** |

---

## Die impliziten Regeln

Sie stehen in `resolve()` in `lib/permissions.ts` — nicht verteilt in den
Server Actions.

1. **Gesperrter Workspace** (`Workspace.suspended`) → keine Mandanten-Rechte.
2. **Offene Einladung** (`WorkspaceMember.pending`) → dasselbe.
3. **Projekt ohne eigenen `ProjectMember`-Eintrag** → alle projektbezogenen
   Rechte fallen weg, es sei denn, die Rechte enthalten `project.view.all`.

Regel 3 gilt für **jedes** Projekt, nicht nur für private: `ProjectMember` ist die
Liste, wer im Projekt ist, und der Resolver liest `Project.visibility` gar nicht.
Die Sichtbarkeit legt nur fest, wer beim Anlegen automatisch eingetragen wird
(`lib/project-membership.ts`).

Die Ausnahme ersetzt den früher hart kodierten Vollzugriff von Owner und Admin:
statt `role === "owner" || role === "admin"` im Code steht die Permission
`project.view.all` in der Rolle. Im Code stehen keine Rollennamen mehr.

> **Regel 1 und 2 greifen, bevor die Mandanten-Rollen eingesammelt werden** —
> nicht danach. Nachträglich zu filtern wäre falsch: manche Permissions sind in
> mehreren Scopes vergebbar (`workspace.delete` etwa auch auf der Plattform), und
> nach dem Vereinigen ist die Herkunft nicht mehr erkennbar. Wer nichts
> einsammelt, kann auch nichts Falsches behalten. `resolver.test.ts` hält das fest.

---

## Rang-Hierarchie

`Role.rank` bildet die Hierarchie ab. Grundregel: **niemand vergibt eine Rolle
über der eigenen und fasst niemanden über sich an.**

Ränge sind nur **innerhalb eines Scopes** vergleichbar — ein Workspace-Owner
(Rang 6) und ein Project Admin (Rang 4) stehen in keiner gemeinsamen Ordnung.
Wer im betreffenden Scope gar keine Rolle trägt, leitet seine Befugnis aus dem
Scope darüber ab und ist nach oben offen. Das erledigt `assignmentCeiling()`:

```ts
assignmentCeiling(access, "PROJECT")
// eigene Projektrolle → deren Rang
// keine Projektrolle  → Infinity (die Befugnis kommt von oben)
```

Der Rang kommt aus der **Datenbank**, nicht aus einer Konstantenliste — damit
greift die Hierarchie auch für selbst angelegte Rollen.

---

## Benutzung

```ts
import {
  getAccess, accessFor, can, hasPermission,
  requirePermission, requirePermissionOr, PLATFORM,
} from "@/lib/permissions";

// Eine Prüfung, wirft bei Fehlschlag:
await requirePermission("workspace.update", { workspaceId });

// `.own`/`.any`-Paar — erfüllt, sobald einer zutrifft:
await requirePermissionOr([
  { permission: "issue.delete.any", ctx: { projectId } },
  { permission: "issue.delete.own", ctx: { projectId },
    ownerIds: [issue.reporterId, issue.assigneeId] },
]);

// Viele Flags auf einmal (Oberflächen, Schleifen) — eine Auflösung statt n:
const access = await getAccess({ projectId });
access.has("issue.create");
access.rank("PROJECT");

// Listen ohne N+1 — die Sichtbarkeitsregel für ganze Projektlisten:
const visible = await accessibleProjectIds(userId, workspaceId);
const mine = await visibleProjectIds(workspaceId);   // für den eingeloggten User

// Zutritt zum Mandanten — keine Permission, sondern Zugehörigkeit:
await canEnterWorkspace(userId, workspaceId);
await currentUserCanEnterWorkspace(workspaceId);
```

### Zutritt ist keine Permission

Für „darf diese Person den Workspace überhaupt betreten?" gibt es keinen Key.
Zutritt hat, wer dazugehört, und dafür gibt es drei Wege: `tenant.access`, eine
**angenommene** Mitgliedschaft, oder eine Projektmitgliedschaft ohne
Workspace-Mitgliedschaft (Projekt-Gast). Der dritte Weg ist der Grund, warum eine
reine `WorkspaceMember`-Abfrage hier nicht genügt.

Die Workspace-Id steht in der URL — ohne diese Prüfung erreicht jeder Angemeldete
jeden Mandanten. `app/[locale]/(default)/[workspace]/layout.tsx` prüft sie.

### Der Kontext ist an die Permission gebunden

`ContextFor<P>` leitet sich aus den `scopes` der Registry ab. Der Typ folgt also
der Datendefinition:

```ts
can(uid, "platform.access",  PLATFORM)         // ✓ nur PLATFORM
can(uid, "workspace.update", { workspaceId })  // ✓ nur WORKSPACE
can(uid, "label.create",     { workspaceId })  // ✓ beide Mandanten-Scopes
can(uid, "label.create",     { projectId })    // ✓
can(uid, "workspace.update", { projectId })    // ✗ Kompilierfehler
can(uid, "issue.create",     PLATFORM)         // ✗ Kompilierfehler
```

Ein falscher Kontext ist damit ein Kompilierfehler statt einer stillen
`false`-Antwort.

### Enforcement

```
1. Server Action / Query / Route Handler   ← Pflicht, hier wird geblockt
2. Layout                                   ← bequem, aber keine Sicherheitsgrenze
3. UI (Buttons verstecken)                  ← nur UX
```

`app/[locale]/(default)/admin/layout.tsx` prüft `platform.access`, **und** die
Abfragen in `features/admin/queries.ts` prüfen noch einmal selbst. Ein Layout
schützt nur die Seiten unter sich, nicht jeden Aufruf einer Funktion.

#### Der Lesepfad prüft mit

Schreibende Actions verlangen ihre Permission, lesende Abfragen die Sichtbarkeit.
Ohne das wäre `blocked` eine Rolle, die nur Knöpfe ausgraut:

| Abfrage | Prüfung |
|---|---|
| `getProjects`, `getProjectsWithStats` | auf `visibleProjectIds` gefiltert |
| `getIssuesByProject` | `project.view` |
| `getIssueById`, `getIssueByRef` | `project.view`, sonst `null` |
| `getSearchIssues`, `getMyIssues`, `getInboxIssues` | auf sichtbare Projekte gefiltert |
| `getLabels` | Projekt-Labels nur aus sichtbaren Projekten |
| `getMembers`, `getTeams` | `canEnterWorkspace` |
| `getProjectMembersView`, `getProjectSettingsView` | `project.view`, sonst `null` |

Diese Prüfungen **fangen leer statt zu werfen**: die Abfragen laufen in Server
Components, die parallel zum Layout rendern — eine Ausnahme landete dort als 500,
bevor das `notFound()` des Layouts greift. Leere Daten führen über die
bestehenden `if (!me) notFound()`-Pfade zum richtigen Ergebnis.

`app/api/issues/[id]/route.ts` liegt außerhalb des Middleware-Matchers (`proxy.ts`
klammert `/api` aus) und prüft deshalb beides selbst: Session und `project.view`.
Ein fehlendes Recht antwortet mit 404, nicht 403 — sonst verriete die Antwort,
dass es das Issue gibt.

#### Wie die Oberfläche davon erfährt

Stufe 3 ist nur UX, aber sie soll nicht raten. **Keine Komponente prüft selbst** —
jede bekommt fertige Flags von der Server Component über ihr, und keine kennt einen
Rollennamen:

| Oberfläche | Flags | Quelle |
|---|---|---|
| Mitglieder (Workspace) | `can.invite`, `can.setRole`, `can.remove` | Seite via `getAccess` |
| Mitglieder (Projekt) | `canAdd`, `canSetRole`, `canRemove`, je Zeile `manageable` | `getProjectMembersView` |
| Projekt-Einstellungen | `canUpdate`, `canDelete` | `getProjectSettingsView` |
| Rollen-Editor | `canManage`, `grantable`, `maxRank`, je Rolle `manageable` | `getRoleManagerView` |
| „Neues Issue" | `creatableProjectIds` | `getIssueComposerData` |

Der letzte Fall zeigt das Muster: es gibt **drei** Stellen, die ein Issue anlegen
(Knopf in der Seitenleiste, Board-Spalte, Gruppenkopf der Liste), und alle drei
bekommen dasselbe `IssueComposerData`. Also wird `issue.create` **einmal** je
sichtbarem Projekt aufgelöst und als `creatableProjectIds` mitgegeben; die Knöpfe
fragen nur noch `includes(projectId)`. Board-Spalte und Gruppenkopf prüfen ihr
eigenes Projekt, der Knopf in der Seitenleiste verschwindet erst, wenn **nirgends**
etwas entstehen darf — und der Projektwechsler im Dialog bietet nur die erlaubten
an. `projects` selbst bleibt vollständig: die Liste löst auch die Angaben
bestehender Issues auf (Prefix, Farbe), gekürzt gäbe es Karten ohne Projektnamen.

---

## Rollen verwalten

Drei Routen, eine Komponente (`features/roles/components/RoleManager`):

| Route | Kontext für `role.manage` | Verwaltet |
|---|---|---|
| `/admin/roles` | Plattform | eigene Plattform-Rollen |
| `/[workspace]/roles` | Workspace | eigene Workspace-Rollen **und** die Projektrollen des Workspace |
| `/[workspace]/project/[slug]/roles` | Projekt | projekteigene Rollen |

`role.manage` ist überall derselbe Key — welcher Topf gemeint ist, entscheidet
allein der Kontext. Die Projektrollen des Workspace hängen bewusst am
Workspace-Kontext: sie gelten in allen seinen Projekten auf einmal.

Die geteilten System-Rollen erscheinen in jeder Ansicht mit, aber gesperrt.

### Schutz gegen Rechte-Eskalation

`features/roles/actions.ts` setzt vier Regeln durch:

- Die geteilten System-Rollen sind unantastbar.
- `role.manage` muss im Kontext des Topfes vorliegen.
- Keine Rolle über dem eigenen Rang anlegen, ändern oder anheben.
- **ALLOW nur für Permissions, die der Handelnde selbst hat.** DENY ist frei —
  etwas zu verbieten vergrößert niemandes Rechte.

Eine Rolle, die noch jemand trägt, lässt sich nicht löschen (Fremdschlüssel auf
`RESTRICT`, plus verständliche Fehlermeldung davor).

---

## Mitglieder verwalten: drei Rechte, nicht eines

`member.invite`, `member.role.update` und `member.remove` sind einzeln vergebbar —
also prüft jede Aktion ihr eigenes, im Workspace (`features/issues/actions.ts`)
wie im Projekt (`features/projects/actions.ts`):

| Aktion | Recht |
|---|---|
| aufnehmen, per E-Mail einladen | `member.invite` |
| Rolle eines Mitglieds ändern | `member.role.update` |
| aus Workspace/Projekt entfernen | `member.remove` |

Die Oberfläche bekommt die drei Flags getrennt (`canAdd`, `canSetRole`,
`canRemove`) und zeigt genau das, was die Action auch durchlässt. Dazu kommen drei
Regeln, die für beide Ebenen gelten: niemand fasst ein höher gestelltes Mitglied
an, niemand sich selbst, und wer `project.view.all` hat, lässt sich per
Projektrolle nicht herabstufen.

### Einladungen

Eine unbekannte Adresse einzuladen erzeugt sofort ein Konto — ohne Passwort, mit
`WorkspaceMember.pending = true` — und dazu einen Token (`Invitation`). Erst das
Annehmen macht daraus einen Zugang: Passwort und Name entstehen, `pending` fällt
weg, und die Projektmitgliedschaften werden nachgezogen (`acceptInvitation` in
`features/auth/actions.ts`).

Das ist der Grund, warum `pending` überhaupt eine Regel im Resolver hat: eine
offene Einladung bekommt keine Rechte, bis sie angenommen ist. Vorher gab es den
Weg dorthin nicht — `pending` wurde gesetzt und nie wieder gelöscht.

`/invite/<token>` ist deshalb öffentlich (`proxy.ts`): der Token *ist* die
Berechtigung, und wer ihn einlöst, hat noch kein Passwort. Unbekannt, abgelaufen,
schon benutzt oder Workspace gesperrt sehen alle gleich aus — sonst wäre die Seite
ein Orakel für gültige Tokens. Mailversand gibt es nicht; die Actions geben den
Link zurück, und die Oberfläche zeigt ihn zum Kopieren.

### Projekt-Sichtbarkeit

`Project.visibility` steuert **nur**, wer automatisch eingetragen wird — den
Zugriff regelt allein `ProjectMember`:

```
public   → wer im Workspace ist, wird aufgenommen (auch später Beitretende)
private  → nur wer ausdrücklich aufgenommen wurde; beim Anlegen nur der Ersteller
```

Auf `public` zu schalten nimmt alle Workspace-Mitglieder auf. Der Weg zurück nimmt
niemandem etwas: wer drin ist, bleibt drin, nur der Automatismus hört auf.
Jemanden hinauszunehmen ist eine eigene, sichtbare Handlung
(`removeProjectMember`) und kein Nebeneffekt eines Schalters — deshalb sagt die
Einstellungsseite das auch ausdrücklich.

Verwaltet wird das unter `/[workspace]/project/[slug]/settings` mit
`project.update`; das Löschen daneben mit `project.delete`.

---

## Datenmodell

```prisma
enum RoleScope        { PLATFORM WORKSPACE PROJECT }
enum PermissionEffect { ALLOW DENY }

model Role {
  id          String    @id   // deterministisch, siehe lib/rbac/id.ts
  scope       RoleScope
  workspaceId String?         // NULL bei System-Rollen
  projectId   String?         // gesetzt nur bei projekteigenen Rollen
  key         String
  rank        Int
  editable    Boolean
  system      Boolean         // geteilte Default-Rolle
}

model Permission {
  key  String @id             // nur Objekt + Aktion, keine Ebene
  desc String
}

model RolePermission {
  roleId, permissionKey, effect  // ALLOW | DENY
}
```

`Permission` trägt **keine** Scope-Spalte: in welchen Scopes ein Key vergeben
werden darf, steht in der Registry (`lib/rbac/permissions.ts`) und wäre in der
Tabelle eine zweite Quelle, die auseinanderlaufen kann.

Rollen-Ids werden deterministisch gebildet (`lib/rbac/id.ts`), damit die
Provisionierung idempotent bleibt. Die Id ist ein getarnter zusammengesetzter
Schlüssel und darf **nirgends geparst werden**:

```
sys:WORKSPACE:member     geteilte System-Rolle
ws:nimbus:reviewer       eigene Workspace-Rolle
wsp:nimbus:triage        eigene Projektrolle, alle Projekte des Workspace
pr:p_7f3a:triage         eigene Projektrolle, nur dieses Projekt
```

Die Eindeutigkeit von (Scope, Eigentümer, Key) sichern **partielle
Unique-Indizes** ab. Ein `@@unique` über die nullable Eigentümerspalten würde
nicht greifen: Postgres hält zwei NULL-Werte für verschieden.

---

## Eine neue Permission einführen

```
1. lib/rbac/permissions.ts        Key, Beschreibung und `scopes` ergänzen
2. lib/rbac/roles.ts              den System-Rollen zuordnen, die sie haben sollen
3. Migration                      Permission-Zeile anlegen und den System-Rollen
                                  zuweisen — jeweils EINE Zeile, nicht eine je
                                  Workspace
4. Guard setzen                   requirePermission(...) an der Server Action
```

Schritt 3 bleibt nötig, weil `provisionSystemRbac` mit
`createMany({ skipDuplicates })` arbeitet und bestehende Rollen nicht anfasst.
Er ist jetzt aber trivial: die Default-Rollen sind geteilt, es gibt also je Rolle
genau eine Zeile zu ergänzen.

---

## Tests

```
tests/unit/permissions/
  rbac.test.ts         Registry: flache Keys, Scope-Zuordnung, Rollen in sich stimmig
  resolver.test.ts     Ersetzen im Projekt, DENY sticht, tenant.access, die
                       impliziten Regeln, Zutritt, sichtbare Projekte
  roleActions.test.ts  geteilte Rollen, Rang-Grenzen, keine Rechte-Eskalation
tests/unit/projects/
  projectMembers.test.ts   die drei member.*-Rechte getrennt, Rang, Selbstbezug
  projectSettings.test.ts  project.update / project.delete, Sichtbarkeitswechsel
tests/unit/invitations/
  invitations.test.ts      Token, Frist, und wann eine Einladung nicht mehr gilt
tests/unit/auth/
  acceptInvitation.test.ts pending → false, Projekte nachziehen, Token verbrauchen
tests/unit/workspace/
  inviteWorkspaceMember.test.ts  bekanntes Konto vs. Einladungslink, Rang-Grenze
tests/unit/issues/
  composerData.test.ts     creatableProjectIds: nur Projekte mit issue.create
tests/unit/ui/
  issueCreateButtons.test.tsx  dass die drei „Neues Issue"-Auslöser verschwinden
```

Die `.tsx`-Tests brauchen `react-dom/server` und laufen deshalb im letzten
Prozess des `test`-Scripts — zusammen mit den Richtext- und Table-Tests, nicht
neben `issues/getLabels.test.ts`, das `react` durch einen Stub ersetzt.

`bun run test` (nicht `bun test` — siehe CLAUDE.md).
