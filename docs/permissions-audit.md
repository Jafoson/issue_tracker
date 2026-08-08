# Berechtigungs-Audit — Bestandsaufnahme

Wo im Code wird eine Berechtigung geprüft, wo nicht, und wo sieht es nur so aus.
Stand: 6. August 2026, Commit `90bfceb`, Arbeitsverzeichnis sauber.

Ergänzt [rbac.md](rbac.md): dort steht, wie das Modell gedacht ist, hier, was
davon im Code angekommen ist.

---

## Zusammenfassung

204 rechte-relevante Flächen einzeln erfasst — jede Server Action, jede Abfrage,
jeder Route Handler, jede Seite, jedes Layout, jede Komponente mit Rechtebezug
und jede Hilfsfunktion in `lib/`.

| Schicht | Flächen | prüft selbst | teilweise | geerbt | nur Flags | keine | n. z. |
|---|---:|---:|---:|---:|---:|---:|---:|
| Server Actions | 30 | 19 | 6 | — | — | 1 | 4 |
| Abfragen (Lesepfad) | 37 | 15 | 9 | 10 | — | 3 | — |
| Route Handler | 4 | 1 | — | — | — | — | 3 |
| Middleware (`proxy.ts`) | 3 | — | 2 | — | — | — | 1 |
| Layouts | 4 | 2 | — | — | — | — | 2 |
| Seiten | 22 | 13 | 4 | 2 | — | — | 3 |
| UI-Komponenten | 56 | — | 10 | 5 | 12 | 22 | 7 |
| Hilfsschicht `lib/` | 48 | 6 | 3 | 13 | — | 2 | 24 |
| **Summe** | **204** | **56** | **34** | **30** | **12** | **28** | **44** |

**Der Kern ist dicht.** Alle 30 Server Actions bis auf `suggestWorkspaceSlug`
prüfen etwas, und der Lesepfad filtert an den Stellen, die
[rbac.md](rbac.md#der-lesepfad-prüft-mit) zusagt — alle sieben Zeilen jener
Tabelle halten. Von 105 gemeldeten Mängeln haben 91 die Gegenprüfung nicht
überlebt, meist weil die Prüfung eine Ebene höher oder tiefer doch stattfindet.

**18 Befunde bleiben** — 5 hoch, 4 mittel, 9 niedrig, **keiner kritisch**. Kein
Befund öffnet fremde Mandantendaten für Außenstehende. Die fünf schweren sind
sämtlich Rechte-Eskalation *innerhalb* der Rollenverwaltung; drei von ihnen
ruhen, solange nur die 15 System-Rollen im Einsatz sind, und werden scharf,
sobald jemand eine eigene Rolle anlegt — also beim eigentlichen Zweck des
Systems.

**Das Gefälle liegt in der Oberfläche.** 22 von 56 Komponenten bieten Aktionen
an, für die sie kein Flag bekommen. Das ist laut
[rbac.md](rbac.md#enforcement) Stufe 3 und damit „nur UX" — die Actions blocken
zuverlässig. Es bedeutet aber, dass `project_viewer` und `blocked` heute eine
voll bedienbare Oberfläche sehen, die erst beim Klick wirft. Und weil es im
ganzen Baum **keine einzige `error.tsx`** gibt, wirft sie ungefangen
([Befund 18](#18-kein-error-boundary-jeder-permissionerror-wird-ein-500-niedrig)).

---

## Legende

| Status | Bedeutung |
|---|---|
| **prüft selbst** | Ruft `requirePermission` / `can` / `hasPermission` / `getAccess().has()` oder filtert auf `accessibleProjectIds` / `visibleProjectIds` |
| **teilweise** | Prüft etwas, aber nicht alles — nur Session, nur Zugehörigkeit, am falschen Objekt, oder ein Feld bleibt ungeprüft |
| **geerbt** | Keine eigene Prüfung, aber ein Layout oder jeder Aufrufer prüft nachweislich |
| **nur Flags** | UI-Bauteil, das fertige Booleans bekommt und nur rendert (Stufe 3) |
| **keine** | Auf keinem Pfad eine Prüfung |
| **n. z.** | Bewusst öffentlich oder ohne Rechtebezug |

Zwei Abgrenzungen, die das ganze Dokument tragen:

**Zugehörigkeit ist keine Berechtigung.** `canEnterWorkspace` hat absichtlich
keinen Permission-Key ([rbac.md](rbac.md#zutritt-ist-keine-permission)). Eine
Abfrage, die nur damit prüft, steht hier als „teilweise" — sie hält Fremde
draußen, sagt aber nichts darüber, wer die Daten lesen darf.

**Ein Rollenname ist keine Berechtigung.** Wer `me.role === "admin"` vergleicht,
prüft etwas, aber am falschen Objekt: eigene Rollen tragen beliebige Keys. Das
ist „teilweise", nicht „prüft selbst".

---

## 1. Server Actions

Stufe 1 — hier wird geblockt. Kontexte: `P` = Plattform, `W` = Workspace,
`Pr` = Projekt.

### `features/issues/actions.ts`

| Action | Status | Prüfung | Ktx |
|---|---|---|---|
| [`moveIssue`](../features/issues/actions.ts#L46) | prüft selbst | `issue.update.any` \| `.own` (ownerIds: reporter, assignee) | Pr |
| [`reorderIssue`](../features/issues/actions.ts#L63) | prüft selbst | `issue.update.any` \| `.own` | Pr |
| [`updateIssue`](../features/issues/actions.ts#L80) | prüft selbst | `issue.update.any` \| `.own`; **zusätzlich** `issue.assign` bei gesetztem `patch.assignee` | Pr |
| [`createIssue`](../features/issues/actions.ts#L116) | **teilweise** | nur `issue.create` — schreibt `assigneeId` ohne `issue.assign` → [Befund 1](#1-createissue-umgeht-das-assign-gate-hoch) | Pr |
| [`createLabel`](../features/issues/actions.ts#L159) | prüft selbst | `label.create`, Kontext je nach `projectId` korrekt gewählt | Pr/W |
| [`deleteIssue`](../features/issues/actions.ts#L207) | prüft selbst | `issue.delete.any` \| `.own` | Pr |
| [`addComment`](../features/issues/actions.ts#L224) | prüft selbst | `comment.create` | Pr |
| [`deleteComment`](../features/issues/actions.ts#L251) | prüft selbst | `comment.delete.any` \| `.own` (ownerIds: authorId) | Pr |

Handwerklich sauber und mehrfach gegengeprüft:

- Die `projectId` kommt überall aus `issueContext(id)`, also aus der DB — nicht
  aus dem Aufruf. Ein Projektwechsel per Patch ist unmöglich: `IssuePatch`
  ([types.ts:68](../features/issues/types.ts#L68)) kennt kein `projectId`, und
  das `data`-Objekt ist eine explizite Feld-Allowlist.
- `reporterId` und `authorId` kommen aus dem Rückgabewert von
  `requirePermission`; die gleichnamigen Client-Parameter sind tot.
- Bei einem Projekt-Label wird die `workspaceId` aus dem Projekt neu bestimmt
  und die client-gelieferte überschrieben.
- Nicht gefundene Issues werfen `PermissionError`, nicht „not found" — keine
  Existenz-Preisgabe.
- `descriptionText` / `bodyText` werden bei jedem Schreiben neu gesetzt
  (CLAUDE.md-Pflicht erfüllt).

Nebenbefunde ohne Rechtebezug: `status` und `type` sind freie Strings und werden
nicht gegen die Workspace-Konfiguration validiert; `labels` (String-Array ohne
Fremdschlüssel) und `assigneeId` werden nicht auf Projekt-Zugehörigkeit geprüft.
Datenintegrität, bleibt im eigenen Projekt. Und `issue.assign` greift auch beim
Selbst-Zuweisen und beim Entfernen, obwohl die Registry es als „Issues *anderen*
zuweisen" beschreibt — eine Rolle mit `issue.update.own` ohne `issue.assign`
kann ein eigenes Issue nicht abgeben.

### `features/projects/actions.ts`

| Action | Status | Prüfung | Ktx |
|---|---|---|---|
| [`createProject`](../features/projects/actions.ts#L78) | prüft selbst | `project.create` | W |
| [`updateProject`](../features/projects/actions.ts#L177) | **teilweise** | `project.update` — deckt den Wechsel `private → public` mit ab → [Befund 7](#7-sichtbarkeitswechsel-hängt-nur-am-projektlokalen-recht-mittel) | Pr |
| [`deleteProject`](../features/projects/actions.ts#L239) | prüft selbst | `project.delete` | Pr |
| [`addProjectMembers`](../features/projects/actions.ts#L360) | prüft selbst | `member.invite` + Rang; verlangt Workspace-Zugehörigkeit; **ohne** Selbstbezug-/`notDowngradable`-Regel | Pr |
| [`setProjectMemberRole`](../features/projects/actions.ts#L398) | prüft selbst | `member.role.update` + Rang + Selbstbezug + `notDowngradable` | Pr |
| [`removeProjectMember`](../features/projects/actions.ts#L442) | prüft selbst | `member.remove` + Rang + Selbstbezug + `notDowngradable` | Pr |
| [`inviteProjectMember`](../features/projects/actions.ts#L486) | **teilweise** | `member.invite` (Projekt) + Rang; die *Workspace*-Zeile entsteht ohne Rang-Grenze → [Befund 2](#2-inviteprojectmember-legt-eine-workspace-rolle-ohne-rang-grenze-an-hoch) | Pr/W |

Die drei Rechte `member.invite` / `member.role.update` / `member.remove` sind
getrennt geprüft, wie [rbac.md](rbac.md#mitglieder-verwalten-drei-rechte-nicht-eines)
zusagt. Die drei Zusatzregeln (niemand fasst Höhergestellte an, niemand sich
selbst, `project.view.all` schützt vor Herabstufung) greifen bei
`setProjectMemberRole` und `removeProjectMember`; bei `addProjectMembers` fehlen
sie, weshalb dort für einen Workspace-Owner ohne bestehende Zeile erstmalig eine
niedrige Rolle angelegt werden kann.

### `features/roles/actions.ts` — die eskalationskritische Fläche

| Action | Status | Prüfung |
|---|---|---|
| [`createRole`](../features/roles/actions.ts#L110) | prüft selbst | `role.manage` im Topf-Kontext + `rank ≤ assignmentCeiling`; `target.workspaceId` bleibt bei Projekt-Töpfen unvalidiert → [Befund 8](#8-createrole-schreibt-eine-unvalidierte-fremde-workspace-id-mittel) |
| [`updateRole`](../features/roles/actions.ts#L162) | prüft selbst | `system`/`editable`-Sperre, `role.manage`, **alter und neuer** Rang gegen das Ceiling |
| [`deleteRole`](../features/roles/actions.ts#L194) | prüft selbst | `system`/`editable`, `role.manage`, Rang, danach Trägerzahl über `_count` (inkl. `platformUsers`) |
| [`setRoleGrant`](../features/roles/actions.ts#L233) | **teilweise** | `role.manage`, Rang, Registry-Key, Scope-Zulässigkeit, ALLOW nur für selbst gehaltene Keys — aber `effect === null` löscht ungeprüft → [Befund 3](#3-setrolegrant-löscht-ein-deny-ungeprüft-hoch) |

Die vier Regeln aus [rbac.md](rbac.md#schutz-gegen-rechte-eskalation) sind
implementiert. Zwei Lücken bleiben: der `null`-Pfad in `setRoleGrant`, und
`requireTargetManage` misst die Rechte im Kontext des Ziel-Topfes — der aus dem
Client-Argument kommt → [Befund 4](#4-platform_admin-verwaltet-rollen-in-jedem-fremden-workspace-hoch).

Kein Pfad parst eine Rollen-Id: die deterministischen Ids aus
[`lib/rbac/id.ts`](../lib/rbac/id.ts) werden nur gebildet, nie zerlegt — wie
[rbac.md](rbac.md#datenmodell) verlangt.

### `features/workspaces/actions.ts`

| Action | Status | Prüfung | Ktx |
|---|---|---|---|
| [`getProjectsForWorkspaces`](../features/workspaces/actions.ts#L49) | prüft selbst | Session + Schnitt mit den eigenen Workspaces, dann `visibleProjectIds` je Workspace | W/Pr |
| [`suggestWorkspaceSlug`](../features/workspaces/actions.ts#L82) | **keine** | — → [Befund 13](#13-suggestworkspaceslug-ist-ein-unangemeldetes-existenz-orakel-niedrig) | — |
| [`createWorkspace`](../features/workspaces/actions.ts#L86) | **teilweise** | nur `getSession()`; bewusst ohne Key — jeder Angemeldete darf einen Workspace anlegen und wird dessen Owner | Session |
| [`setMemberRole`](../features/workspaces/actions.ts#L191) | prüft selbst | `member.role.update` + Rangvergleich beidseitig + Selbstbezug gesperrt | W |
| [`removeMember`](../features/workspaces/actions.ts#L242) | prüft selbst | `member.remove` + Rang; `dropProjectMemberships` in derselben Transaktion | W |
| [`inviteWorkspaceMember`](../features/workspaces/actions.ts#L290) | prüft selbst | `member.invite` + `assignmentCeiling`; `owner` gesperrt | W |

`createWorkspace` ohne Key ist eine Produktentscheidung, keine Lücke — es gibt
keinen Permission-Key dafür, und Selbstregistrierung ist der vorgesehene Weg.
Fehlt: eine Mengenbegrenzung pro Konto.

Zwei Randfälle: `assignmentCeiling` liefert `Infinity`, wenn der Handelnde im
Workspace-Scope selbst keine Rolle trägt — ein `tenant.access`-Support darf
damit jede Nicht-Owner-Rolle austeilen, während `setMemberRole` ihn mit Rang -1
blockt. Und `removeMember` löscht die offenen `Invitation`-Zeilen des Entfernten
nicht mit; der Token bleibt einlösbar (setzt dann Passwort und Namen, aber ohne
Workspace-Zutritt, weil die Mitgliedschaftszeile fehlt).

### `features/auth/actions.ts`

| Action | Status | Anmerkung |
|---|---|---|
| [`login`](../features/auth/actions.ts#L23) | n. z. | öffentlich; Passwortprüfung in [`auth.ts:52`](../auth.ts#L52) (bcrypt, einheitliche Fehlermeldung → keine Konten-Enumeration; kein Rate-Limit). `callbackUrl` unvalidiert → [Befund 14](#14-offene-weiterleitung-über-callbackurl-niedrig) |
| [`register`](../features/auth/actions.ts#L50) | n. z. | öffentlich; kein Rate-Limit, und die Antwort unterscheidet „E-Mail existiert" vom Erfolg → Konten enumerierbar |
| [`acceptInvitation`](../features/auth/actions.ts#L115) | **teilweise** | der Token *ist* die Berechtigung; [`openInvitation`](../lib/invitations.ts#L109) prüft Existenz, `acceptedAt`, Ablauf und `workspace.suspended`. `hasPassword` wird ignoriert → [Befund 6](#6-acceptinvitation-ignoriert-haspassword-mittel) |
| [`logout`](../features/auth/actions.ts#L189) | n. z. | `signOut` mit festem Zielpfad |
| [`signInWithOAuth`](../features/auth/actions.ts#L194) | n. z. | festes Ziel; `provider` wird nicht gegen `enabledOAuthProviders` validiert (Folge ist nur ein Auth.js-Fehler) |

---

## 2. Der Lesepfad — Abfragen

[rbac.md](rbac.md#der-lesepfad-prüft-mit) macht hier konkrete Zusagen. **Alle
sieben Zeilen jener Tabelle halten.** Die Ergänzungen unten betreffen Abfragen,
die dort nicht aufgeführt sind.

### `features/issues/queries.ts`

| Abfrage | Status | Prüfung |
|---|---|---|
| [`getIssuesByProject`](../features/issues/queries.ts#L257) | prüft selbst | `project.view` → `[]` |
| [`getIssueById`](../features/issues/queries.ts#L377) | prüft selbst | `project.view` → `null` |
| [`getIssueByRef`](../features/issues/queries.ts#L397) | prüft selbst | `project.view` → `null` |
| [`getSearchIssues`](../features/issues/queries.ts#L419) | prüft selbst | `visibleProjectIds`, Early-Return `[]` |
| [`getMyIssues`](../features/issues/queries.ts#L337) | prüft selbst | `accessibleProjectIds` |
| [`getInboxIssues`](../features/issues/queries.ts#L352) | prüft selbst | `accessibleProjectIds` |
| [`getProjects`](../features/issues/queries.ts#L101) | prüft selbst | `visibleProjectIds` |
| [`getLabels`](../features/issues/queries.ts#L151) | **teilweise** | nur der Zweig `projectId: { in: visible }`; `projectId: null` bleibt ungefiltert, auch bei leerer Menge → [Befund 11](#11-workspaceweite-konfiguration-ist-ohne-zutritt-lesbar-niedrig) |
| [`getMembers`](../features/issues/queries.ts#L123) | **teilweise** | nur `currentUserCanEnterWorkspace` → [Befund 9](#9-projekt-gäste-lesen-die-komplette-mitgliederliste-mittel) |
| [`getTeams`](../features/issues/queries.ts#L233) | **teilweise** | nur Zutritt; `projects` gibt zusätzlich IDs unsichtbarer Projekte heraus |
| [`getWorkspace`](../features/issues/queries.ts#L83) | **keine** | nur `where: { id, suspended: false }` — Name und Farbe jedes Workspace lesbar |
| [`getUserWorkspaces`](../features/issues/queries.ts#L92) | geerbt | Aufrufer übergeben `session.userId`; kein Abgleich in der Funktion, kein Filter auf `pending`/`suspended` |
| [`getStatuses`](../features/issues/queries.ts#L173) [`getPriorities`](../features/issues/queries.ts#L189) [`getIssueTypes`](../features/issues/queries.ts#L204) [`getRoles`](../features/issues/queries.ts#L219) | geerbt | keine eigene Prüfung; nur [`[workspace]/layout.tsx:34`](../app/[locale]/%28default%29/[workspace]/layout.tsx#L34) schützt sie → [Befund 11](#11-workspaceweite-konfiguration-ist-ohne-zutritt-lesbar-niedrig) |

Alle Prüfungen fangen leer (`[]` / `null`) statt zu werfen — korrekt, weil
Server Components parallel zum Layout rendern.

### `features/projects/queries.ts` — hier entstehen die UI-Flags

| Abfrage | Status | Prüfung und gelieferte Flags |
|---|---|---|
| [`getProjectsWithStats`](../features/projects/queries.ts#L21) | prüft selbst | `visibleProjectIds` |
| [`getProjectSettingsView`](../features/projects/queries.ts#L55) | prüft selbst | `project.view` → `null`; Flags `canUpdate` (`project.update`), `canDelete` (`project.delete`) |
| [`getProjectMembersView`](../features/projects/queries.ts#L135) | prüft selbst | `project.view` → `null`; Flags `canAdd`, `canSetRole`, `canRemove`, `actorRank`, **je Zeile `manageable`** (geerbte Zeilen `false`) |

Vorbildlich: Prüfung und UI-Flag kommen aus derselben Auflösung, und die Flags
entsprechen genau den Keys, die die Actions verlangen. Einzige Abweichung:
`canAdd` spiegelt nur `member.invite` im Projekt, während
`inviteProjectMember` für eine *unbekannte* Adresse zusätzlich `member.invite`
im Workspace verlangt — das Einladeformular erscheint also auch dann, wenn es
für neue Adressen scheitern wird.

### `features/admin/queries.ts`

| Abfrage | Status | Prüfung |
|---|---|---|
| [`getAllUsers`](../features/admin/queries.ts#L69) | prüft selbst | `requirePlatformAccess()` → `platform.access` |
| [`getPlatformStats`](../features/admin/queries.ts#L96) | prüft selbst | `platform.access` |
| [`getCurrentUser`](../features/admin/queries.ts#L51) | **keine** | kein Key, kein Selbstbezug-Abgleich → [Befund 12](#12-zwei-admin-abfragen-ohne-guard-niedrig) |
| [`getFirstWorkspaceId`](../features/admin/queries.ts#L107) | **keine** | dito |

Die Doppelprüfung, die [rbac.md](rbac.md#enforcement) verspricht (Layout **und**
Abfrage), gilt für zwei der vier Funktionen. Und `platform.access` ist der
grobste Key: `user.manage` existiert in der Registry für genau diesen Zweck,
wird aber nirgends geprüft — `platform_support` liest damit alle E-Mail-Adressen.

### `features/workspaces/queries.ts` und `features/roles/queries.ts`

| Abfrage | Status | Prüfung |
|---|---|---|
| [`getWorkspaceProjects`](../features/workspaces/queries.ts#L112) [`getWorkspaceSearchIssues`](../features/workspaces/queries.ts#L136) | prüft selbst | delegieren an die gefilterten Issue-Abfragen |
| [`requireWorkspaceId`](../features/workspaces/queries.ts#L39) | **keine** | zieht den Mandanten aus dem Request-Store und prüft nur, dass er *gesetzt* ist — die Klammer, auf die zwölf `getWorkspace*`-Funktionen ihre Absicherung auslagern |
| [`getWorkspaceMembers`](../features/workspaces/queries.ts#L108) | **teilweise** | Einzeiler auf `getMembers` — also nur Zutritt, kein Key |
| [`getCurrentWorkspace`](../features/workspaces/queries.ts#L50) | geerbt | keine eigene Prüfung; Gate nur im Layout |
| [`getMe`](../features/workspaces/queries.ts#L75) | teilweise | Session; **fällt ohne Workspace-Mitgliedschaft auf das eigene Konto zurück** — deshalb fängt `if (!me) notFound()` Nicht-Mitglieder *nicht* ab |
| [`getMyWorkspaces`](../features/workspaces/queries.ts#L58) | teilweise | filtert weder `suspended` noch `pending` — der Switcher zeigt Workspaces, die man nicht betreten kann |
| [`getWorkspaceLabels`](../features/workspaces/queries.ts#L116) | teilweise | erbt die `getLabels`-Lücke |
| [`getWorkspaceStatuses`](../features/workspaces/queries.ts#L120) … [`getWorkspaceRoles`](../features/workspaces/queries.ts#L132) | geerbt | siehe `getStatuses` ff. |
| [`getRoleManagerView`](../features/roles/queries.ts#L25) | **teilweise** | liefert `canManage`, `grantable`, `maxRank`, `manageable` — liest die Rollen samt Grants und `memberCount` aber **vor** und unabhängig von `canManage` → [Befund 10](#10-adminroles-liest-ohne-rolemanage-niedrig) |

`getMe`s Fallback ist die stille Voraussetzung mehrerer Seiten: `notFound()` bei
`!me` sieht nach einem Mitgliedschafts-Gate aus, ist aber keines.

---

## 3. Die HTTP-Kante

`proxy.ts` klammert `/api` aus dem Matcher aus — Route Handler müssen deshalb
alles selbst prüfen.

| Fläche | Status | Prüfung |
|---|---|---|
| [`app/api/issues/[id]/route.ts` `GET`](../app/api/issues/[id]/route.ts#L14) | prüft selbst | `currentUserId()` → 401, dann `project.view` → **404** (nicht 403 — die Antwort verrät nicht, dass das Issue existiert). Nur `GET` existiert, also keine ungeschützte Methode |
| [`app/api/auth/[...nextauth]/route.ts`](../app/api/auth/[...nextauth]/route.ts) | n. z. | Auth.js-Handler, CSRF durch `@auth/core` |
| [`app/api/logout/route.ts`](../app/api/logout/route.ts#L6) | n. z. | kein Rechtebezug, aber zustandsändernder `GET` ohne Methodenbeschränkung → [Befund 15](#15-apilogout-ist-ein-zustandsändernder-get-niedrig) |
| [`proxy.ts` `PUBLIC_PATHS`](../proxy.ts#L11) | n. z. | `/login`, `/register`, `/invite`; das Locale-Präfix wird vorher über [`i18n/routing.ts`](../i18n/routing.ts) abgeschnitten. Prefix-Match — künftige Unterpfade werden automatisch öffentlich |
| [`proxy.ts` Middleware](../proxy.ts#L16) | teilweise | nur Session (JWT), kein Key und kein DB-Abgleich — das Token eines gelöschten Kontos passiert bis zum Ablauf |
| [`proxy.ts` `config.matcher`](../proxy.ts#L47) | teilweise | `/((?!api\|_next\|_vercel\|.*\..*).*)` — Pfade mit Punkt sind ausgenommen |

Die Middleware ist **keine Sicherheitsgrenze**, sondern Routing: Server Actions
haben global auflösbare IDs und sind über jeden öffentlichen Pfad erreichbar.
Genau deshalb prüft jede Action selbst — mit der Ausnahme
`suggestWorkspaceSlug`, die sich allein auf den Proxy verlässt.

Der einzige Client-Lesepfad über HTTP ist
[`useIssueDetail.ts:47`](../features/issues/components/IssueDetail/useIssueDetail.ts#L47),
das `/api/issues/[id]` per `fetch` zieht und `updateIssue`/`addComment`/`deleteIssue`
aufruft — die Absicherung liegt vollständig in Route und Actions.
[`useTabBar.ts`](../components/ui/layout/TabBar/useTabBar.ts) ruft
`getProjectsForWorkspaces` mit Workspace-IDs aus `localStorage` auf; die Action
filtert selbst auf die eigenen Mandanten.

---

## 4. Layouts und Seiten

Layouts sind Stufe 2 — bequem, aber keine harte Grenze.

| Layout | Status | Prüfung |
|---|---|---|
| [`[workspace]/layout.tsx`](../app/[locale]/%28default%29/[workspace]/layout.tsx#L34) | prüft selbst | Session → `/login`, dann `canEnterWorkspace` → `notFound()` (nicht `redirect`, damit die Existenz des Workspace nichts verrät) |
| [`admin/layout.tsx`](../app/[locale]/%28default%29/admin/layout.tsx#L25) | prüft selbst | `platform.access` → `notFound()` |
| [`project/[projectSlug]/layout.tsx`](../app/[locale]/%28default%29/[workspace]/project/[projectSlug]/layout.tsx) | **n. z.** | rein präsentational — **kein `project.view`**. Der Schutz aller Projektseiten hängt daran, dass jede Kindseite selbst prüft; ein Vergessen fällt nicht auf |
| [`[locale]/layout.tsx`](../app/[locale]/layout.tsx#L36) | n. z. | nur Locale-Validierung |

Es gibt **kein** `app/layout.tsx` und keine `error.tsx` / `not-found.tsx` /
`loading.tsx` im ganzen Baum ([Befund 18](#18-kein-error-boundary-jeder-permissionerror-wird-ein-500-niedrig)).

### Seiten

| Seite | Status | Prüfung |
|---|---|---|
| [`[workspace]/page.tsx`](../app/[locale]/%28default%29/[workspace]/page.tsx) | prüft selbst | `visibleProjectIds` über `getWorkspaceProjects` |
| [`[workspace]/inbox`](../app/[locale]/%28default%29/[workspace]/inbox/page.tsx) [`my`](../app/[locale]/%28default%29/[workspace]/my/page.tsx) | prüft selbst | `accessibleProjectIds` + `issue.create` je Projekt |
| [`[workspace]/issue/[issueRef]`](../app/[locale]/%28default%29/[workspace]/issue/[issueRef]/page.tsx) | prüft selbst | `getIssueByRef` → `null` → `notFound()`; auch `generateMetadata` (Zeile 21) läuft darüber. **Löst keine Schreibrechte für die UI auf** |
| [`[workspace]/members`](../app/[locale]/%28default%29/[workspace]/members/page.tsx#L23) | prüft selbst | `getAccess({ workspaceId })` → `can.invite` / `.setRole` / `.remove`; Lesezugriff nur über Zutritt → [Befund 9](#9-projekt-gäste-lesen-die-komplette-mitgliederliste-mittel), [Befund 17](#17-die-workspace-mitgliederverwaltung-zeigt-mehr-als-die-action-erlaubt-niedrig) |
| [`[workspace]/projects`](../app/[locale]/%28default%29/[workspace]/projects/page.tsx) | prüft selbst | `visibleProjectIds`; **kein `project.create`-Flag** für den Knopf |
| [`[workspace]/roles`](../app/[locale]/%28default%29/[workspace]/roles/page.tsx#L30) | prüft selbst | `role.manage` → `notFound()` |
| [`[workspace]/settings`](../app/[locale]/%28default%29/[workspace]/settings/page.tsx) | **teilweise** | nur `getMe()` → `notFound()`. **Kein `workspace.update`** → [Befund 16](#16-workspace-einstellungen-und-teams-ohne-recht-niedrig) |
| [`[workspace]/teams`](../app/[locale]/%28default%29/[workspace]/teams/page.tsx) | **teilweise** | nur Zutritt via `getMembers`/`getTeams`. **Kein `team.*`** → [Befund 16](#16-workspace-einstellungen-und-teams-ohne-recht-niedrig) |
| [`project/[projectSlug]/page.tsx`](../app/[locale]/%28default%29/[workspace]/project/[projectSlug]/page.tsx) [`list`](../app/[locale]/%28default%29/[workspace]/project/[projectSlug]/list/page.tsx) | prüft selbst | Slug gegen `visibleProjectIds` → `notFound()`, dann `project.view` in `getIssuesByProject` |
| [`project/[projectSlug]/members`](../app/[locale]/%28default%29/[workspace]/project/[projectSlug]/members/page.tsx) | prüft selbst | `getProjectMembersView` → `null` → `notFound()` |
| [`project/[projectSlug]/settings`](../app/[locale]/%28default%29/[workspace]/project/[projectSlug]/settings/page.tsx) | prüft selbst | `getProjectSettingsView` → `null` → `notFound()`; Flags `canUpdate`/`canDelete` |
| [`project/[projectSlug]/roles`](../app/[locale]/%28default%29/[workspace]/project/[projectSlug]/roles/page.tsx#L33) | prüft selbst | `role.manage` → `notFound()` |
| [`admin/page.tsx`](../app/[locale]/%28default%29/admin/page.tsx) | prüft selbst | über `getPlatformStats` → `platform.access` (zusätzlich Layout) |
| [`admin/members`](../app/[locale]/%28default%29/admin/members/page.tsx) | teilweise | über `getAllUsers` → `platform.access` — deckt aber E-Mail-Adressen aller Konten ab, wo `user.manage` gemeint wäre |
| [`admin/roles`](../app/[locale]/%28default%29/admin/roles/page.tsx) | geerbt | nur `platform.access` vom Layout, **kein `role.manage`** → [Befund 10](#10-adminroles-liest-ohne-rolemanage-niedrig) |
| [`[locale]/page.tsx`](../app/[locale]/page.tsx) | **teilweise** | wählt per `findFirst` einen Workspace **ohne** `canEnterWorkspace`, ohne `pending: false`, ohne `suspended: false` und ohne `orderBy` — wer nur eine offene Einladung hat, landet in einem `notFound` |
| [`(auth)/login`](../app/[locale]/%28auth%29/login/page.tsx) | n. z. | öffentlich; `callbackUrl` unvalidiert → [Befund 14](#14-offene-weiterleitung-über-callbackurl-niedrig) |
| [`(auth)/register`](../app/[locale]/%28auth%29/register/page.tsx) | n. z. | öffentlich; anders als `login` **ohne** Redirect für Angemeldete |
| [`(auth)/invite/[token]`](../app/[locale]/%28auth%29/invite/[token]/page.tsx) | n. z. | bewusst öffentlich, der Token ist die Berechtigung. Unbekannt / abgelaufen / verbraucht / gesperrt sehen gleich aus — **kein Orakel** |
| [`(auth)/create-workspace`](../app/[locale]/%28auth%29/create-workspace/page.tsx) | geerbt | Session nur über den Proxy; die Action prüft sie selbst |

---

## 5. Die Oberfläche

[rbac.md](rbac.md#wie-die-oberfläche-davon-erfährt) fordert: **keine Komponente
prüft selbst, keine kennt einen Rollennamen.** Die erste Hälfte hält —
nachgeprüft: **keine** der 56 Komponenten ruft `getAccess`, `hasPermission`,
`accessFor` oder `requirePermission` auf. Die zweite Hälfte nicht.

**Was Flags bekommt (12):**

| Oberfläche | Flags | Quelle |
|---|---|---|
| Mitglieder (Workspace) | `can.invite`, `can.setRole`, `can.remove` | [`members/page.tsx:23`](../app/[locale]/%28default%29/[workspace]/members/page.tsx#L23) via `getAccess` |
| Mitglieder (Projekt) | `canAdd`, `canSetRole`, `canRemove`, je Zeile `manageable` | `getProjectMembersView` |
| Projekt-Einstellungen | `canUpdate`, `canDelete` | `getProjectSettingsView` |
| Rollen-Editor | `canManage`, `grantable`, `maxRank`, `manageable` | `getRoleManagerView` |
| „Neues Issue" (3 Auslöser) | `creatableProjectIds` | `getIssueComposerData` |

Der letzte Fall ist das Vorbild: `issue.create` wird **einmal** je sichtbarem
Projekt aufgelöst, die drei Auslöser
([`NewIssueButton`](../features/issues/components/NewIssueButton/NewIssueButton.tsx),
[`BoardColumn`](../features/issues/components/BoardColumn/BoardColumn.tsx),
[`ListGroupHeader`](../features/issues/components/ListView/components/ListGroupHeader.tsx))
fragen nur `includes(projectId)`, und der Projektwechsler im Dialog bietet nur
die erlaubten an.

**Was keine Flags bekommt (22 Komponenten, hier nach Bereich gruppiert — die
Liste nennt auch die Hooks und die teilweise versorgten Fälle mit)** — jede
rendert eine Aktion, die erst die Action ablehnt:

| Bereich | Komponenten | fehlendes Flag |
|---|---|---|
| Issue-Detail | `IssueDetail`, `IssueDetailView`, `IssueDetailPage(View)`, `IssueTitle`, `IssueDescription`, `IssueProperties`, `IssueLabels`, `IssueComments`, `IssueActionsMenu`, `IssueSidebar` | `issue.update.own/.any`, `issue.delete.*`, `comment.create`, `issue.assign` |
| Board / Liste | `Board`, `BoardCard`, `ListView`, `IssueCells`, `useBoardDnd`, `useIssuePatch` | `issue.update.*` (Ziehen, Statuswechsel) |
| Zuweisen / Labels | `AssigneePicker`, `LabelPickerMenu`, `LabelFilter` | `issue.assign`, `label.create` |
| Projekte | `NewProjectButton`, `CreateProjectModal` | `project.create` |
| Navigation | `Sidebar`, `NavGroup`, `NavGroupWorkspace`, `NavGroupProjects`, `CommandPalette` | `member.invite`, `role.manage`, `workspace.update`, `project.update` |

Praktische Folge: `project_viewer` und `blocked` sehen eine voll bedienbare
Oberfläche. Kein Sicherheitsproblem — Stufe 1 hält —, aber `blocked` ist damit
heute „eine Rolle, die Knöpfe *nicht* ausgraut".

Strukturell fehlt dafür die Grundlage: [`lib/nav.ts`](../lib/nav.ts#L31) hat kein
`permission`-Feld an `NavEntry`, und `Sidebar` nimmt kein Access-Objekt an.
Solange das so ist, ist Stufe 3 für die Navigation gar nicht umsetzbar. Umgekehrt
hat `deleteComment` überhaupt keine Oberfläche.

Zwei Server Components liefern nebenbei personenbezogene Daten an den Client, die
niemand rechtlich begrenzt: [`Topbar.tsx`](../features/issues/components/Topbar/Topbar.tsx)
lädt `getWorkspaceMembers()` (inkl. E-Mail) für die Filterleiste, und
[`IssueRichText`](../features/issues/components/IssueRichText/IssueRichText.tsx)
gibt Mitgliederliste und workspaceweite Issue-Titel als `@`/`#`-Vorschläge in den
Editor — beides trägt [Befund 9](#9-projekt-gäste-lesen-die-komplette-mitgliederliste-mittel).

**Drei Verstöße gegen „keine Rollennamen im Code":**

| Ort | Code |
|---|---|
| [`Settings.tsx:23`](../features/admin/components/Settings/Settings.tsx#L23) | `const isAdmin = me.role === "admin" \|\| me.role === "owner"` |
| [`Teams.tsx:20`](../features/admin/components/Teams/Teams.tsx#L20) | `const isAdmin = me.role === "admin" \|\| me.role === "owner"` |
| [`Members.tsx:49`](../features/admin/components/Members/Members.tsx#L49) | `roles.filter(r => r.id !== "owner" && r.rank <= (me.roleRank ?? -1))` — baut die Rangregel im Client nach |

Das ist genau das Muster, das [rbac.md](rbac.md#die-impliziten-regeln) für
abgeschafft erklärt („Im Code stehen keine Rollennamen mehr"). Es trägt heute
nur, weil die beiden ersten Seiten keine Server Action haben. Eigene Rollen —
der Sinn des ganzen Systems — werden davon nicht erfasst: eine selbst angelegte
Rolle mit `team.create` sieht den Knopf nie, eine umbenannte Rolle mit dem Key
`admin` dagegen immer. Dazu passend wählt
[`InviteMemberModal.tsx:48`](../features/admin/components/Members/components/InviteMemberModal.tsx#L48)
`"member"` als Default per Literal, statt eine `defaultRole` vom Server zu
bekommen (wie `AddProjectMembersModal` sie hat).

---

## 6. Hilfsschicht `lib/`

| Datei | Status | Anmerkung |
|---|---|---|
| [`lib/permissions.ts`](../lib/permissions.ts) | **die Quelle** | Alle Prüfungen laufen hier zusammen: `can`/`hasPermission`/`requirePermission(Or)`/`getAccess`/`accessFor`, `canEnterWorkspace`, `accessibleProjectIds`, `assignmentCeiling`. Die drei impliziten Regeln (`suspended`, `pending`, kein `ProjectMember`-Eintrag), der `tenant.access`-Generalschlüssel und `keepsProjectRights` stehen an genau einer Stelle — wie [rbac.md](rbac.md#die-impliziten-regeln) verspricht |
| [`lib/rbac/*`](../lib/rbac/) | n. z. | reine Registry; die `scopes` werden beim Vergeben über `isPermissionAllowedIn` erzwungen |
| [`lib/project-membership.ts`](../lib/project-membership.ts#L61) | geerbt | alle Aufrufer prüfen. Aber `projectRoleKeyFor` leitet aus `member.invite` die Rolle `project_admin` ab → [Befund 5](#5-projectrolekeyfor-verleiht-manager-die-rollenverwaltung-im-projekt-hoch) |
| [`createInvitation`](../lib/invitations.ts#L38) | geerbt | keine eigene Prüfung; Aufrufer prüfen `member.invite` |
| [`openInvitation`](../lib/invitations.ts#L109) | prüft selbst | Token, `acceptedAt`, Ablauf, `workspace.suspended`; liefert `hasPassword`, das nur die Seite honoriert → [Befund 6](#6-acceptinvitation-ignoriert-haspassword-mittel) |
| [`lib/session.ts`](../lib/session.ts#L6) | teilweise | kein DB-Abgleich — Existenz oder Sperrung des Kontos wird nicht geprüft, das Token gilt bis zum Ablauf. Trägt, weil jede Rechteprüfung ohnehin frisch in die DB geht |
| [`lib/current-workspace.ts`](../lib/current-workspace.ts) | n. z. | reiner Request-Store ohne Prüfung |
| [`lib/rbac-provision.ts`](../lib/rbac-provision.ts) | n. z. | nur über Seed/Skript erreichbar, nicht über Action oder Route |
| [`lib/nav.ts`](../lib/nav.ts#L31) | keine | Navigations-Konstanten ohne `permission`-Feld (siehe oben) |
| [`lib/user-defaults.ts`](../lib/user-defaults.ts) [`lib/workspace-defaults.ts`](../lib/workspace-defaults.ts) | n. z. | Namens-/Handle-Erzeugung, kein Rechtebezug |
| [`auth.config.ts`](../auth.config.ts#L22) | teilweise | `trustHost: true` bei auskommentiertem `AUTH_URL` ([`example.env:8`](../example.env#L8)) — hinter einem Proxy ohne Host-Filter per Host-Header beeinflussbar |
| [`auth.ts`](../auth.ts#L52) | n. z. | bcrypt-Vergleich, einheitliche Fehlermeldung; **kein Rate-Limit/Lockout** |

Nicht einzeln aufgeführt, weil ohne Rechtebezug: [`lib/richtext/`](../lib/richtext/)
(abhängigkeitsfrei, reine Dokumenttransformation), [`lib/context/`](../lib/context/),
[`lib/utils/`](../lib/utils/), [`types/`](../types/) und die
Rich-Text-Editor-Bausteine unter
[`components/ui/layout/RichTextEditor/`](../components/ui/layout/RichTextEditor/).
[`i18n/routing.ts`](../i18n/routing.ts) ist mittelbar relevant: es definiert die
Locale-Präfixe, die `proxy.ts` abschneidet, bevor `PUBLIC_PATHS` greift.

---

## 7. Permission-Keys: deklariert vs. durchgesetzt

34 Keys in [`lib/rbac/permissions.ts`](../lib/rbac/permissions.ts).
**13 haben keine einzige Prüfstelle** in `app/`, `features/`, `components/`, `lib/`:

| Key | Warum ungeprüft |
|---|---|
| `workspace.update` | Kein `updateWorkspace` existiert; [`Settings.tsx`](../features/admin/components/Settings/Settings.tsx) hat keine Server Action |
| `workspace.delete` | keine Action |
| `workspace.suspend` | keine Action — `Workspace.suspended` wird an vier Stellen *gelesen*, von keiner geschrieben |
| `config.manage`, `audit.view` | kein Feature |
| `user.manage` | Feature existiert ([`admin/members`](../app/[locale]/%28default%29/admin/members/page.tsx)), prüft aber `platform.access` statt diesen Key; es gibt keine Aktion, die `platformRoleId` ändert |
| `team.create/.update/.delete/.member.manage/.project.manage` | [`Teams.tsx`](../features/admin/components/Teams/Teams.tsx) hat keine Server Action; Sichtbarkeit hängt an einem Rollennamen |
| `label.update`, `label.delete` | kein `updateLabel`/`deleteLabel` |

**Das sind überwiegend keine Lücken, sondern noch nicht gebaute Features** — die
Registry läuft der Implementierung voraus, und die Rollenmatrix im Editor
vergibt Rechte, die nichts bewirken. Zwei Ausnahmen:

- `user.manage` ist gebaut, aber der falsche (grobere) Key wird geprüft.
- `workspace.update` und `team.*` fehlen dort, wo die Oberfläche stattdessen
  Rollennamen vergleicht. Sobald diese Seiten eine Action bekommen, fehlt der
  Guard vollständig — die Rollennamen-Prüfung ist Client-Code.

Die 21 durchgesetzten Keys, nach Prüfstellen: `project.view` (9),
`member.invite` (8), `project.view.all` (5), `member.remove` (5),
`member.role.update` (5), `issue.update.any` (4), `project.delete` (4),
`role.manage` (3), `project.update` (3), `label.create` (3),
`issue.update.own` (3), `issue.create` (3), `comment.create` (2),
`comment.delete.any` (2), `platform.access` (2), `tenant.access` (1),
`project.create` (1), `issue.assign` (1), `issue.delete.any` (1),
`issue.delete.own` (1), `comment.delete.own` (1).

---

## 8. Befunde

18 Befunde. Einstufung: **hoch** = Schreibvorgang oder Eskalation ohne Recht ·
**mittel** = Datenleck ohne Änderung · **niedrig** = UX, Metainformation oder
Robustheit. Keiner ist kritisch: kein Außenstehender erreicht fremde
Mandantendaten.

### 1. `createIssue` umgeht das Assign-Gate (hoch)

[`features/issues/actions.ts:116`](../features/issues/actions.ts#L116) prüft nur
`issue.create`, schreibt aber `assigneeId` — während
[`updateIssue:93`](../features/issues/actions.ts#L93) für genau dieses Feld
zusätzlich `issue.assign` verlangt. Der Zwei-Schritt-Weg ist zu, der
Ein-Schritt-Weg offen.

Mit den System-Rollen ruht die Lücke: jede Rolle mit `issue.create` trägt auch
`issue.assign`. Sie greift bei eigenen Rollen — `setRoleGrant` setzt jeden Key
einzeln, eine Rolle „Contributor ohne Zuweisung" ist baubar, und `createIssue`
ignoriert dort sogar ein DENY.

**Fix:** `if (data.assignee) await requirePermission("issue.assign", { projectId: data.projectId })`.

### 2. `inviteProjectMember` legt eine Workspace-Rolle ohne Rang-Grenze an (hoch)

[`features/projects/actions.ts:486`](../features/projects/actions.ts#L486) prüft
`member.invite` im Projekt und die Rang-Grenze der *Projekt*-Rolle korrekt. Für
eine unbekannte Adresse entsteht zusätzlich eine `WorkspaceMember`-Zeile mit der
Default-Rolle `member` (Rang 2) — **ohne** `assignmentCeiling(access, "WORKSPACE")`.
[`inviteWorkspaceMember:308`](../features/workspaces/actions.ts#L308) erzwingt
diese Grenze.

Ausnutzbar über eine eigene Workspace-Rolle mit Rang 0 oder 1, die
`member.invite` trägt — also genau die plausible „darf nur einladen"-Rolle. Wer
sie hat, darf per `inviteWorkspaceMember` nur Rang ≤ 1 vergeben (viewer/guest),
erzeugt hier aber ein Konto mit Rang 2 (`issue.create`, `issue.update.own`,
`issue.assign`, `label.create`) — und bekommt den Einladungslink zurück, kann die
zweite Identität also selbst übernehmen.

**Fix:** die abgeleitete Workspace-Rolle gegen `assignmentCeiling(…, "WORKSPACE")`
stellen.

### 3. `setRoleGrant` löscht ein DENY ungeprüft (hoch)

[`features/roles/actions.ts:254`](../features/roles/actions.ts#L254): bei
`effect === null` löscht `deleteMany` die Zeile, ohne ihren bisherigen Effekt zu
lesen. Die Regel „ALLOW nur für selbst gehaltene Keys" greift nur für
`effect === "ALLOW"`.

Ein DENY zu entfernen ist rechteerweiternd, sobald es ein ALLOW einer anderen
Ebene maskiert hat — und dass ein DENY über alle Ebenen sticht, ist gewollte
Grenze ([rbac.md](rbac.md#wozu-dann-noch-deny)). Zwei erreichbare Fälle: eine
Workspace-Rolle mit DENY auf einem projektbezogenen Key (die Projektrolle greift
nach dem Löschen), und DENY auf `workspace.delete` oder `role.manage` — die
einzigen Keys in PLATFORM *und* WORKSPACE, wo das Workspace-DENY das ALLOW der
Plattform-Rolle maskiert.

Die Oberfläche schirmt nichts ab: in
[`PermissionMatrix.tsx:56`](../features/roles/components/PermissionMatrix/PermissionMatrix.tsx#L56)
ist nur der ALLOW-Knopf an `grantable` gebunden (`allowLocked`), der
„unset"-Knopf ist frei klickbar. Und
[`roleActions.test.ts:262`](../tests/unit/permissions/roleActions.test.ts#L262)
schreibt das Verhalten sogar fest — der Test muss beim Fix mitgeändert werden.

**Fix:** vor dem Löschen den Eintrag lesen und bei `effect === "DENY"` dieselbe
`access.has(permission)`-Prüfung anwenden.

### 4. `platform_admin` verwaltet Rollen in jedem fremden Workspace (hoch)

[`requireTargetManage`](../features/roles/actions.ts#L50) misst die Rechte im
Kontext des Ziel-Topfes — und der kommt aus dem Client-Argument.
[`loadBase`](../lib/permissions.ts#L262) vereinigt die Plattform-Grants ohne
Herkunftsvermerk in das Workspace-Ergebnis, und `role.manage` ist in allen drei
Scopes vergebbar. Also gilt `access.has("role.manage")` in **jedem** Workspace,
auch einem gesperrten; `assignmentCeiling` liefert ohne eigene Workspace-Rolle
`Infinity`.

Wirkung: `platform_admin` (hat `role.manage`, aber ausdrücklich **nicht**
`tenant.access`, und das Layout sperrt ihn aus dem Mandanten aus) kann in jedem
fremden Workspace eigene Rollen anlegen, umbenennen, umranken, löschen und
beliebige DENY-Einträge setzen. DENY unterliegt der Grant-Regel bewusst nicht —
das ist Aussperr-Potenzial in fremden Mandanten.

Nicht erreichbar: projektlokale Töpfe, System-Rollen, Inhaltsrechte (ALLOW nur
`workspace.delete`/`role.manage`), jeder Lesezugriff auf Mandanteninhalte.
Deshalb hoch, nicht kritisch.

**Fix:** in `requireTargetManage` für Mandanten-Töpfe zusätzlich
`canEnterWorkspace(actorId, target.workspaceId)` verlangen — oder `loadBase` die
Herkunft mitführen lassen.

### 5. `projectRoleKeyFor` verleiht `manager` die Rollenverwaltung im Projekt (hoch)

[`lib/project-membership.ts:72`](../lib/project-membership.ts#L72) leitet die
automatische Projektrolle aus den Workspace-Rechten ab:
`has("member.invite") || has("project.view.all")` → `project_admin`. Und
`project_admin`s ALLOW ist `permissionsFor("PROJECT")` — das **enthält
`role.manage`** (19 Keys, per `bun run` nachgeprüft).

Die Rolle `manager` ist in [`lib/rbac/roles.ts:129`](../lib/rbac/roles.ts#L129)
ausdrücklich ohne `role.manage` definiert („Keine Rollenverwaltung"), trägt aber
`member.invite`. Beim Anlegen eines öffentlichen Projekts wird sie deshalb als
`project_admin` eingetragen — und hat dort `role.manage`, also projekteigene
Rollenverwaltung. Die Rollenbeschreibung sagt das Gegenteil.

Die Ableitung entscheidet faktisch die Rechte jedes neu Aufgenommenen und ist in
[rbac.md](rbac.md#projekt-sichtbarkeit) nicht dokumentiert — dort steht nur,
*wer* eingetragen wird, nicht *mit welcher Rolle*.

**Fix:** eine Projektrolle zwischen `project_admin` und `contributor` ohne
`role.manage` als Ziel der Ableitung, oder die Ableitung an
`role.manage`/`project.view.all` statt an `member.invite` hängen.

### 6. `acceptInvitation` ignoriert `hasPassword` (mittel)

[`lib/invitations.ts:151`](../lib/invitations.ts#L151) liefert `hasPassword`,
aber nur die Seite
([`invite/[token]/page.tsx:31`](../app/[locale]/%28auth%29/invite/[token]/page.tsx#L31))
honoriert es. Die Action
[`acceptInvitation:127`](../features/auth/actions.ts#L127) überschreibt
`passwordHash` und Namen jedes Kontos, zu dem ein offener Token existiert.

Dass das heute niemanden übernimmt, ist Glück der Aufrufreihenfolge, keine
Prüfung: Tokens entstehen nur für frisch angelegte Konten ohne Passwort. Sobald
eine Einladung an ein bestehendes Konto möglich wird, ist es eine
Konto-Übernahme — und der Guard steht auf Stufe 3, nicht auf Stufe 1.

**Fix:** die `hasPassword`-Prüfung in die Action ziehen.

### 7. Sichtbarkeitswechsel hängt nur am projektlokalen Recht (mittel)

[`updateProject:177`](../features/projects/actions.ts#L177) prüft
`project.update` im Projekt-Kontext. Damit kann ein `project_admin` ohne jedes
workspaceweite Recht ein privates Projekt auf `public` schalten — was laut
[rbac.md](rbac.md#projekt-sichtbarkeit) **alle** Workspace-Mitglieder aufnimmt
und deren Mitgliedszeilen anlegt. Ein Vorgang mit Workspace-Reichweite,
autorisiert durch ein Projekt-Recht.

### 8. `createRole` schreibt eine unvalidierte fremde Workspace-Id (mittel)

Bei `target = { scope: "PROJECT", workspaceId, projectId }` autorisiert
[`targetGuard`](../features/roles/scope.ts#L83) über `{ projectId }`, geschrieben
wird aber `ownerColumns(target).workspaceId` aus dem Client-Argument
([`actions.ts:132`](../features/roles/actions.ts#L132)). Es fehlt die Prüfung,
dass `projectId` zu `workspaceId` gehört. Die Vorbedingung ist billig:
`Workspace.id` ist der frei gewählte Slug, und `suggestWorkspaceSlug` verrät,
welche belegt sind.

Kein Rechtegewinn (die Zeile taucht in keinem Topf des fremden Workspace auf),
aber ein falsches Cascade-Ziel: `Role_workspaceId_fkey` ist `ON DELETE CASCADE`,
`ProjectMember.role` dagegen `RESTRICT` — der fremde Workspace lässt sich dann
nicht mehr löschen.

### 9. Projekt-Gäste lesen die komplette Mitgliederliste (mittel)

[`getMembers:123`](../features/issues/queries.ts#L123) prüft nur
`currentUserCanEnterWorkspace`. Weg 3 dieser Funktion (Projektmitgliedschaft
ohne Workspace-Mitgliedschaft) lässt einen `project_guest` durch — jemanden, der
laut Rollenbeschreibung „von außen zu genau diesem Projekt eingeladen" ist. Er
erhält die vollständige `WorkspaceMember`-Liste mit Namen, Handle,
**E-Mail-Adresse**, Rollen-Key, Rang und `pending`.

Sichtbar unter [`/[workspace]/members`](../app/[locale]/%28default%29/[workspace]/members/page.tsx)
(E-Mail in [`Members.tsx:112`](../features/admin/components/Members/Members.tsx#L112)),
in `/teams`, in der [`Topbar`](../features/issues/components/Topbar/Topbar.tsx)
und in den `@`-Mention-Vorschlägen. Erreichbar, weil `getMe()` auf das eigene
Konto zurückfällt und `notFound()` deshalb ausbleibt.

Einen Lesekey gibt es nicht — `member.view` existiert in der Registry nicht.
`getTeams` hat dasselbe Muster und gibt zusätzlich IDs unsichtbarer Projekte
heraus.

**Fix:** entweder ein neuer Key, oder die Liste für Nicht-Workspace-Mitglieder
auf die Mitglieder ihrer sichtbaren Projekte einschränken — wobei die
`getMe()`-Ausnahme erhalten bleiben muss, sonst laufen Gäste in 404.

### 10. `/admin/roles` liest ohne `role.manage` (niedrig)

Die beiden Schwesterseiten prüfen `role.manage` und werfen `notFound()`;
[`admin/roles/page.tsx`](../app/[locale]/%28default%29/admin/roles/page.tsx) erbt nur
`platform.access` vom Layout. Ursache liegt tiefer:
[`getRoleManagerView`](../features/roles/queries.ts#L32) lädt Rollen samt Grants
und `memberCount` **unabhängig** von `canManage` — gedämpft werden nur
`manageable`, `grantable` und `maxRank`.

Wer `platform.access` ohne `role.manage` hat (System-Rolle `platform_support`)
sieht damit alle Plattform-Rollen samt Permission-Grants und Trägerzahlen.
Schreiben ist dicht (`grantable` leer, `maxRank = -Infinity`), und
`platform_support` liest über `tenant.access` ohnehin alles — daher niedrig.

**Fix:** der Guard in `getRoleManagerView` selbst, dann greift er für alle drei
Routen.

### 11. Workspaceweite Konfiguration ist ohne Zutritt lesbar (niedrig)

`getStatuses`, `getPriorities`, `getIssueTypes`, `getRoles` und
[`getWorkspace:83`](../features/issues/queries.ts#L83) prüfen nichts;
[`getLabels:151`](../features/issues/queries.ts#L151) filtert nur den
Projekt-Zweig — `projectId: null` geht auch bei leerer `visible`-Menge hinaus.
`getRoles` gibt dabei die selbst angelegten Rollennamen und Ränge eines
beliebigen Workspace heraus.

Getragen wird das allein vom Workspace-Layout — also von der Stufe, die
[rbac.md](rbac.md#enforcement) selbst „keine Sicherheitsgrenze" nennt. Solange
diese Funktionen nur aus Seiten unter diesem Layout laufen, ist es dicht; ein
Aufruf aus einer Server Action oder einem Route Handler wäre es nicht. Die
gemeinsame Klammer ist [`requireWorkspaceId`](../features/workspaces/queries.ts#L39),
die selbst nichts prüft.

### 12. Zwei Admin-Abfragen ohne Guard (niedrig)

[`getCurrentUser:51`](../features/admin/queries.ts#L51) und
[`getFirstWorkspaceId:107`](../features/admin/queries.ts#L107) prüfen weder
`platform.access` noch den Selbstbezug — ein Aufruf mit fremder `userId` liefert
E-Mail und Plattform-Rolle bzw. eine Workspace-Zugehörigkeit. Beide sind derzeit
nirgends aufgerufen (tote Exporte); die pauschale Zusage in
[rbac.md](rbac.md#enforcement) stimmt damit für 2 von 4 Funktionen.

Dieselbe latente Form haben `getMyIssues`, `getInboxIssues` und
`getUserWorkspaces` — sie berechnen die Sichtbarkeit für den *übergebenen*
Nutzer, nicht für den eingeloggten. Heute wird überall die Session-Id übergeben.

### 13. `suggestWorkspaceSlug` ist ein unangemeldetes Existenz-Orakel (niedrig)

[`features/workspaces/actions.ts:82`](../features/workspaces/actions.ts#L82) — die
einzige Server Action ohne jede eigene Prüfung. Die einzige Grenze ist das
Session-Gate im Proxy, und das ist laut Next-Doku ausdrücklich kein Ersatz:
Action-IDs sind global auflösbar, ein POST über `/login` oder `/invite/<token>`
umgeht es. Die Antwort verrät, welche Slugs belegt sind — reine
Metainformation, ein Slug ist kein Schlüssel (Zutritt hängt an
`canEnterWorkspace`). Zusätzlich ohne Obergrenze: `uniqueWorkspaceSlug` macht
eine Query je belegter Variante, ausgelöst per 300-ms-Debounce pro Tastendruck.

**Fix:** zwei Zeilen — `currentUserId()`-Prüfung plus eine Obergrenze.

### 14. Offene Weiterleitung über `callbackUrl` (niedrig)

`callbackUrl` wird an keiner Stelle auf einen relativen Pfad geprüft und erreicht
zwei Senken: [`login/page.tsx:16`](../app/[locale]/%28auth%29/login/page.tsx#L16)
(`redirect` aus `next/navigation`, folgt absoluten Fremd-URLs; `/login` ist
öffentlich, hier wirkt auch `//evil.example`) und
[`actions.ts:39`](../features/auth/actions.ts#L39) → `router.push` in
[`LoginForm.tsx:43`](../features/auth/components/LoginForm/LoginForm.tsx#L43).
Auth.js' Same-Origin-Schutz ist umgangen, weil `signIn` mit `redirect: false`
ohne `redirectTo` läuft.

Kein RBAC-Bypass, kein Cookie-Abfluss — Phishing auf einer vertrauenswürdig
aussehenden URL. `javascript:`-URLs blockiert Next selbst.

**Fix:** ein `safeCallbackPath`-Helper, an beiden Senken verwendet (nur `/…`,
nicht `//` oder `/\`).

### 15. `/api/logout` ist ein zustandsändernder GET (niedrig)

[`app/api/logout/route.ts`](../app/api/logout/route.ts) beschränkt die Methode
nicht, und `next-auth` ruft `signOut()` intern mit `skipCSRFCheck`. Ein fremdes
`<img src="/api/logout">` loggt den Benutzer aus. Belästigung, kein
Rechteproblem.

### 16. Workspace-Einstellungen und Teams ohne Recht (niedrig)

[`settings/page.tsx`](../app/[locale]/%28default%29/[workspace]/settings/page.tsx)
prüft kein `workspace.update`,
[`teams/page.tsx`](../app/[locale]/%28default%29/[workspace]/teams/page.tsx) kein
`team.*` — beide nur `getMe()` → `notFound()` plus Zutritt aus dem Layout. Heute
harmlos, weil keine der beiden Seiten eine Server Action besitzt; die
Sichtbarkeit hängt an einem Rollennamen im Client (siehe
[Abschnitt 5](#5-die-oberfläche)). **Sobald diese Seiten eine Action bekommen,
fehlt der Guard vollständig.**

### 17. Die Workspace-Mitgliederverwaltung zeigt mehr als die Action erlaubt (niedrig)

[`Members.tsx:134`](../features/admin/components/Members/Members.tsx#L134) füllt
den Rollen-Picker jeder Zeile mit `roles` — **allen** Rollen, inklusive `owner`
und solchen über dem eigenen Rang. Das vorgefilterte `assignableRoles` wird nur
für den Einladungsdialog benutzt (Zeile 57). Der Entfernen-Knopf (Zeile 167)
hängt nur an `can.remove` und „nicht ich selbst", ohne Rangvergleich gegen das
Ziel.

`setMemberRole` und `removeMember` weisen das korrekt ab — die Oberfläche
verspricht also mehr, als die Action durchlässt. Das ist genau umgekehrt zur
Zusage in [rbac.md](rbac.md#mitglieder-verwalten-drei-rechte-nicht-eines) („zeigt
genau das, was die Action auch durchlässt"), die auf Projekt-Ebene über das
je-Zeile-`manageable` eingehalten wird. Auf Workspace-Ebene fehlt dieses Flag.

### 18. Kein Error-Boundary, jeder `PermissionError` wird ein 500 (niedrig)

Im ganzen Baum existiert **keine** `error.tsx`, `not-found.tsx`,
`global-error.tsx` oder `app/layout.tsx`. Ein `PermissionError` aus `moveIssue`,
`updateIssue`, `setMemberRole` oder `removeMember` schlägt deshalb ungefangen
durch. Weil zugleich 22 Komponenten Aktionen ohne Flag anbieten
([Abschnitt 5](#5-die-oberfläche)), ist das der Regelfall für `project_viewer`
und `blocked`, nicht der Ausnahmefall: sichtbarer Knopf → Klick → 500.

Die Actions, die `RoleResult`/`ProjectResult` mit `{ error }` zurückgeben, sind
davon nicht betroffen — nur die, die werfen.

---

## 9. Was nachweislich dicht ist

91 der 105 gemeldeten Mängel wurden widerlegt. Die aufschlussreichsten:

- **Der Lesepfad ist konsequent gefiltert.** Jede Behauptung, Issues aus
  unsichtbaren Projekten seien erreichbar, scheiterte an `visibleProjectIds` /
  `accessibleProjectIds` oder an `project.view` in `getIssueById`/`getIssueByRef`.
- **Kommentare, Labels und Mention-Vorschläge** erben die Prüfung des Issues
  bzw. sind auf sichtbare Projekte geschnitten.
- **Der Projekt-Gast-Zweig** in `inviteProjectMember` ist bewusst so gebaut, vom
  Resolver auf dieses eine Projekt begrenzt und durch
  [`projectMembers.test.ts:437`](../tests/unit/projects/projectMembers.test.ts#L437)
  fixiert — kein Mangel.
- **Die geteilten System-Rollen** sind auf allen vier Pfaden von
  `features/roles/actions.ts` unantastbar.
- **`/invite/<token>`** ist kein Orakel: unbekannt, abgelaufen, verbraucht und
  gesperrt sehen gleich aus.
- **`app/api/issues/[id]`** antwortet bei fehlendem Recht 404, nicht 403.
- **Keine Komponente** ruft `getAccess` oder `hasPermission` selbst auf.
- **Keine Rollen-Id wird geparst.**
- **Kein Kontext kommt aus dem Client, wo es zählt:** `projectId` stammt in den
  Issue-Actions aus der DB, `reporterId`/`authorId` aus der Session, und die
  `workspaceId` eines Projekt-Labels wird aus dem Projekt neu bestimmt.

---

## 10. Abgleich mit `docs/rbac.md`

**Stimmt:** das Enforcement-Stufenmodell; alle sieben Zeilen der Tabelle „Der
Lesepfad prüft mit" inklusive „fangen leer statt zu werfen"; alle fünf Zeilen der
Flag-Tabelle „Wie die Oberfläche davon erfährt"; die drei impliziten Regeln;
`tenant.access`; die Rang-Hierarchie und `assignmentCeiling`; die drei
getrennten `member.*`-Rechte; die vier Eskalationsregeln der Rollenverwaltung;
die Rollen-Routen-Tabelle; 15 System-Rollen mit 212 `RolePermission`-Zeilen
(nachgerechnet); der `CHECK`-Constraint und die partiellen Unique-Indizes; und
alle in `rbac.md` genannten Testdateien existieren.

**Veraltet oder zu optimistisch:**

| Zusage in `rbac.md` | Realität |
|---|---|
| „im Workspace (`features/issues/actions.ts`)" für die `member.*`-Aktionen | Falscher Pfad — sie liegen in [`features/workspaces/actions.ts`](../features/workspaces/actions.ts#L191); in `features/issues/actions.ts` steht kein `member.*`-Guard |
| „Im Code stehen keine Rollennamen mehr" | `Settings.tsx:23`, `Teams.tsx:20`, `Members.tsx:49`, `InviteMemberModal.tsx:48` |
| „Keine Komponente prüft selbst — jede bekommt fertige Flags" | Erste Hälfte stimmt (0 von 56); 22 Komponenten bekommen **keine** Flags und rendern die Aktion trotzdem |
| „zeigt genau das, was die Action auch durchlässt" | Auf Projekt-Ebene ja; auf Workspace-Ebene zeigt die UI **mehr** ([Befund 17](#17-die-workspace-mitgliederverwaltung-zeigt-mehr-als-die-action-erlaubt-niedrig)) |
| Flag-Namen `canAdd`/`canSetRole`/`canRemove` für beide Ebenen | Auf Workspace-Ebene heißen sie `can.invite`/`can.setRole`/`can.remove` |
| „die Abfragen in `features/admin/queries.ts` prüfen noch einmal selbst" | 2 von 4 |
| „Fremdschlüssel auf `RESTRICT`" | Nur Workspace- und Projektrollen ([schema.prisma:140/194](../prisma/schema.prisma#L140)); `User.platformRole` ist `onDelete: SetNull` ([:76](../prisma/schema.prisma#L76)) — dort stoppt nur der App-Vorabcheck |
| PLATFORM „steuert … Konten, Workspaces sperren" | Beide Features existieren nicht: `user.manage` und `workspace.suspend` haben keinen Guard und keine Action, `Workspace.suspended` wird nur gelesen |
| `manager` „ohne `role.manage`" | Im Projekt-Kontext doch, über `projectRoleKeyFor` → `project_admin` ([Befund 5](#5-projectrolekeyfor-verleiht-manager-die-rollenverwaltung-im-projekt-hoch)) |

**Nicht dokumentiert:** dass 13 der 34 Keys keine Prüfstelle haben; dass
`project/[projectSlug]/layout.tsx` keinen `project.view`-Guard hat; dass `getMe()`
auf das eigene Konto zurückfällt und `if (!me) notFound()` deshalb keine
Mitgliedschaft erzwingt; dass Zutritt zur Mitgliederliste E-Mail-Adressen
einschließt; dass die Navigation nicht rechteabhängig gefiltert wird; dass
`projectRoleKeyFor` die Startrolle im Projekt bestimmt; und dass es keinen
Error-Boundary gibt.

**Nebenbefund Code vs. Schema:** [`lib/permissions.ts:141`](../lib/permissions.ts#L141)
beschreibt „eine Zeile ohne `roleId`" in `ProjectMember`, aber
[`schema.prisma:190`](../prisma/schema.prisma#L190) hat `roleId String` (NOT
NULL) — der Fall kann nicht auftreten, der Kommentar ist irreführend.

---

## 11. Testabdeckung

32 Testdateien, 442 Tests. Für Berechtigungen relevant:

| Fläche | Tests | Datei |
|---|---:|---|
| Resolver (Ersetzen, DENY, `tenant.access`, implizite Regeln, Zutritt, sichtbare Projekte) | 39 | [`permissions/resolver.test.ts`](../tests/unit/permissions/resolver.test.ts) |
| Projekt-Mitglieder (drei Rechte, Rang, Selbstbezug) | 30 | [`projects/projectMembers.test.ts`](../tests/unit/projects/projectMembers.test.ts) |
| Registry (flache Keys, Scopes, Rollen in sich stimmig) | 26 | [`permissions/rbac.test.ts`](../tests/unit/permissions/rbac.test.ts) |
| Rollenverwaltung (geteilte Rollen, Rang, keine Eskalation) | 25 | [`permissions/roleActions.test.ts`](../tests/unit/permissions/roleActions.test.ts) |
| `createProject` | 16 | [`projects/createProject.test.ts`](../tests/unit/projects/createProject.test.ts) |
| Einladungen (Token, Frist, Gültigkeit) | 15 | [`invitations/invitations.test.ts`](../tests/unit/invitations/invitations.test.ts) |
| Projekt-Einstellungen, Sichtbarkeit | 14 | [`projects/projectSettings.test.ts`](../tests/unit/projects/projectSettings.test.ts) |
| Projekt-Mitgliedschaft (Aufnahme/Austritt) | 13 | [`projects/projectMembership.test.ts`](../tests/unit/projects/projectMembership.test.ts) |
| Einladung annehmen | 11 | [`auth/acceptInvitation.test.ts`](../tests/unit/auth/acceptInvitation.test.ts) |
| `createLabel` | 11 | [`issues/createLabel.test.ts`](../tests/unit/issues/createLabel.test.ts) |
| Workspace-Einladung, Rang-Grenze | 11 | [`workspace/inviteWorkspaceMember.test.ts`](../tests/unit/workspace/inviteWorkspaceMember.test.ts) |
| „Neues Issue"-Auslöser (Stufe 3) | 10 | [`ui/issueCreateButtons.test.tsx`](../tests/unit/ui/issueCreateButtons.test.tsx) |
| Proxy / Middleware | 9 | [`proxy/proxy.test.ts`](../tests/unit/proxy/proxy.test.ts) |
| `creatableProjectIds` | 5 | [`issues/composerData.test.ts`](../tests/unit/issues/composerData.test.ts) |

**Die größte Lücke:** die Issue-Actions (`moveIssue`, `reorderIssue`,
`updateIssue`, `createIssue`, `deleteIssue`, `addComment`, `deleteComment`) haben
**keine eigene Testdatei**. Die `.own`/`.any`-Paare und das `issue.assign`-Gate —
also die am häufigsten ausgeführten Guards des Systems — sind nirgends fixiert.
Ebenso ungetestet: der Lesepfad (`getIssuesByProject`, `getIssueByRef`,
`getSearchIssues`), `app/api/issues/[id]`, der Projekt-Knopf (das Issue-Pendant
hat Tests) und die Navigationsfilterung.

[`roleActions.test.ts:262`](../tests/unit/permissions/roleActions.test.ts#L262)
fixiert das fehlerhafte Verhalten aus
[Befund 3](#3-setrolegrant-löscht-ein-deny-ungeprüft-hoch) und muss beim Fix
mitgeändert werden.

Aufruf immer mit `bun run test`, nie `bun test` (Modul-Cache, siehe CLAUDE.md).

---

## 12. Empfohlene Reihenfolge

1. **[Befund 3](#3-setrolegrant-löscht-ein-deny-ungeprüft-hoch)** — vier Zeilen,
   schließt den einzigen Selbstbeförderungspfad. Test mitändern.
2. **[Befund 5](#5-projectrolekeyfor-verleiht-manager-die-rollenverwaltung-im-projekt-hoch)** —
   betrifft jeden Workspace mit einem `manager` und öffentlichen Projekten, also
   den Standardfall.
3. **[Befund 1](#1-createissue-umgeht-das-assign-gate-hoch)** und
   **[Befund 2](#2-inviteprojectmember-legt-eine-workspace-rolle-ohne-rang-grenze-an-hoch)** —
   je eine Zeile, beide sind Symmetriefehler gegenüber der Schwester-Action.
4. **[Befund 4](#4-platform_admin-verwaltet-rollen-in-jedem-fremden-workspace-hoch)** —
   eine Zeile in `requireTargetManage`.
5. **[Befund 9](#9-projekt-gäste-lesen-die-komplette-mitgliederliste-mittel)** —
   Entscheidung nötig: neuer Key `member.view` oder Einschränkung auf gemeinsame
   Projekte.
6. **[Befund 18](#18-kein-error-boundary-jeder-permissionerror-wird-ein-500-niedrig)** —
   eine `error.tsx` je Route-Gruppe, danach sind die fehlenden UI-Flags
   erträglich statt hässlich.
7. **Tests für die Issue-Actions** — die ungetestete Fläche mit dem meisten
   Verkehr.
8. Die Stufe-3-Flags und `lib/nav.ts` um ein `permission`-Feld erweitern; die
   drei Rollennamen-Vergleiche ersetzen.

---

## Methode

11 parallele Leser über die Flächengruppen, jeder gemeldete Mangel anschließend
von einem eigenen Agenten mit dem Auftrag geprüft, ihn zu **widerlegen**
(Aufrufkette nach oben und unten, implizite Resolver-Regeln, bestehende Tests).
105 Behauptungen, 91 widerlegt, 14 bestätigt; zwei weitere Befunde kamen aus dem
Doku-Abgleich und einer aus der Vollständigkeitsprüfung hinzu. 118 Agenten
insgesamt.

Vollständigkeit gegengeprüft über `grep -rl '"use server"'` (genau 5 Dateien),
alle exportierten Funktionen je `actions.ts`/`queries.ts`, alle Router-Dateien,
alle `db.`-Zugriffe außerhalb von `queries.ts`/`actions.ts` und eine Suche nach
inline `"use server"` in `.tsx` (keine) — keine rechte-relevante Fläche fehlte.

Von Hand nachgeprüft: die Key-Abdeckung (34 deklariert, 13 ohne Prüfstelle),
`setRoleGrant`s `null`-Pfad, `createIssue` ohne `issue.assign`,
`requireTargetManage`s Kontext aus dem Client-Argument,
`permissionsFor("PROJECT").includes("role.manage")` (via `bun run`), die
Rollennamen in `Settings.tsx`/`Teams.tsx`/`Members.tsx`, `roles` vs.
`assignableRoles` im Rollen-Picker, das Fehlen jeder `error.tsx`, die
`onDelete`-Regeln in `schema.prisma`, die Zeilennummern in `lib/invitations.ts`,
die fehlenden Actions für `workspace.*`/`team.*`/`label.update|delete`, und die
vier Layouts.
