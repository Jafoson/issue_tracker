@AGENTS.md

# Issue Tracker — Projektkonventionen

## Stack

- **Next.js 16** (App Router) mit TypeScript
- **React 19** — Server Components sind Standard
- **Biome** für Linting und Formatting (kein ESLint, kein Prettier)
- **SCSS** (sass) für Styles — kein Tailwind
- **PostgreSQL** via **Prisma** (Prisma 7, `prisma.config.ts` statt `schema.prisma` als Einstiegspunkt)

## Next.js 16 — Breaking Changes (wichtig!)

Diese Version weicht von älteren Next.js-Versionen ab. Vor dem Schreiben von Code immer `node_modules/next/dist/docs/` lesen.

- `params` und `searchParams` in Pages/Layouts sind jetzt **Promises** → immer awaiten:
  ```ts
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
  }
  ```
- Data Mutations verwenden **Server Functions** (`'use server'`), nicht API Routes
- Keine `getServerSideProps` / `getStaticProps` — alles über `async` Server Components und Server Functions

## Komponentenarchitektur

### Business Logic vs. UI trennen

Jede Feature-Komponente wird in zwei Teile aufgeteilt:

```
components/
  issues/
    IssueList.tsx        ← Server Component: Daten laden, Logik
    IssueList.module.scss
    IssueListView.tsx    ← UI-Rendering (kann "use client" sein wenn nötig)
    IssueCard.tsx        ← Wiederverwendbare Teil-Komponente
    IssueCard.module.scss
```

- `*View.tsx` oder `*UI.tsx` = reines Rendering, keine Geschäftslogik
- Server Components fetchen Daten und reichen sie als Props weiter
- Client Components (`'use client'`) nur für Interaktivität (onClick, onChange, Browser-APIs)

### Wiederverwendung

- Komponenten modular halten — lieber eine Komponente öfter nutzen als duplizieren
- Shared UI in `components/ui/` ablegen

## Styling

- **SCSS Modules** (`.module.scss`) für Komponenten-Styles
- **Globale Styles** in `app/globals.css` oder `app/globals.scss`
- Aussehen-Änderungen **immer in CSS/SCSS** umsetzen, nicht per JavaScript
- CSS-Features aktiv nutzen: `:before`, `:after`, CSS Custom Properties, `:is()`, `:has()`
- Keine Inline-Styles für Aussehen (nur für wirklich dynamische Werte wie berechnete Positionen)

## React-Regeln

- **Server Rendering bevorzugen** — `async` Server Components sind Standard
- `useEffect` minimieren — nur wenn kein server-seitiger Ansatz möglich ist
- `useMemo` / `useCallback` nur bei nachgewiesenem Performance-Problem einsetzen
- State so nah wie möglich an der Verwendungsstelle halten, nicht global liften wenn vermeidbar
- Formulare per `<form action={serverAction}>` statt `onSubmit` + fetch

## Rich Text (Beschreibungen und Kommentare)

`Issue.description` und `Comment.body` sind **ProseMirror-Dokumente** (`Json`),
keine Strings. Lesen und Schreiben sind getrennt:

| | Komponente | Umgebung |
|---|---|---|
| Anzeigen | `components/ui/atoms/RichText` | Server Component, **keine** Abhängigkeit |
| Bearbeiten | `components/ui/atoms/RichTextEditor` | `"use client"`, Tiptap, per `next/dynamic` |

- Die Anzeige übersetzt das JSON von Hand nach React — kein `generateHTML`, kein
  `dangerouslySetInnerHTML`. Wer dort einen Knotentyp ergänzt, muss die passende
  Extension im Editor mitliefern (und umgekehrt).
- Der Editor wird nie direkt importiert, sondern über `next/dynamic` mit
  `ssr: false` — sonst landet das Bündel auch im Lesepfad.
- Fachliche Vorschlagsdaten (`@` Mitglieder, `#` Issues) kommen als Props herein.
  `components/ui` kennt weder Workspace noch Prisma; die Brücke ist
  `features/issues/components/IssueRichText`.
- Neben jeder Dokumentspalte liegt eine abgeleitete Textspalte
  (`descriptionText`, `bodyText`) für die Suche — `contains` arbeitet nicht auf
  `Json`. Sie wird in `features/issues/actions.ts` bei **jedem** Schreibvorgang
  aus `toPlainText(doc)` neu gesetzt.
- `lib/richtext/` ist abhängigkeitsfrei und läuft überall (Tests, Seed, Skripte):
  `toDoc`/`isEmptyDoc` (Eingang aus der DB), `toPlainText`/`toPreview`
  (Suche, Vorschauen), `fromMarkdown` (Seed und einmalige Migration).

## Prisma

- Schema: `prisma/schema.prisma`
- Config: `prisma.config.ts` (Prisma 7 neu)
- Client-Output: `lib/generated/prisma`
- DB-Zugriff nur in Server Components, Server Functions und Route Handlers
- Prisma Client als Singleton in `lib/db.ts` exportieren

```ts
// lib/db.ts
import { PrismaClient } from "@/app/generated/prisma"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

### Schema ändern — Pflicht-Checkliste

**Immer alle drei Schritte ausführen, nie nur einen:**

```
1. prisma/schema.prisma  anpassen
2. bun prisma migrate dev --name <beschreibung>   ← erstellt Migration + regeneriert Client
3. Seed und alle Server Actions/Queries prüfen    ← neue Pflichtfelder überall ergänzen
```

**Warum alle drei?**
- Schritt 1 allein → Client und DB sind out of sync, Laufzeitfehler
- Schritt 2 allein (ohne 1) → keine Migration, DB fehlt das Feld
- Schritt 3 vergessen → Seed schlägt fehl, `bun db:reset` bricht ab

**Feld hinzufügen (NOT NULL ohne Default):**
```sql
-- In der generierten migration.sql ergänzen, BEVOR migrate deploy läuft:
ALTER TABLE "Model" ADD COLUMN "feld" TEXT;
UPDATE "Model" SET "feld" = <backfill>;          -- bestehende Zeilen befüllen
ALTER TABLE "Model" ALTER COLUMN "feld" SET NOT NULL;
```
Prisma erzeugt für NOT-NULL-Spalten ohne Default kein valides SQL für existierende Daten.
Die Migration manuell um den Backfill-Schritt erweitern.

**Migrations-Verzeichnis niemals leer lassen:**
Ein Ordner in `prisma/migrations/` ohne `migration.sql` bricht `migrate deploy` ab (Error P3015).
Entweder die Datei erstellen oder das leere Verzeichnis löschen.

## Verzeichnisstruktur

```
app/                              ← Nur Routing
│   layout.tsx
│   page.tsx
│   globals.scss
│   (auth)/                       ← Route Group (kein URL-Segment)
│   │   login/page.tsx
│   │   register/page.tsx
│   issues/
│   │   page.tsx                  ← /issues
│   │   loading.tsx               ← Suspense-Skeleton
│   │   error.tsx                 ← Error Boundary
│   │   new/page.tsx
│   │   [id]/
│   │       page.tsx
│   │       _components/          ← Private Folder: nur für diese Route
│   generated/
│       prisma/                   ← Generierter Prisma Client (nicht anfassen)
│
components/
│   ui/                           ← Generische, domänenlose UI-Bausteine
│   │   atoms/                    ← Kleinste, unteilbare Bausteine
│   │   │   Button/
│   │   │   │   Button.tsx
│   │   │   │   button.module.scss
│   │   │   Badge/
│   │   │   │   Badge.tsx
│   │   │   │   badge.module.scss
│   │   │   Input/
│   │   │       Input.tsx
│   │   │       input.module.scss
│   │   layout/                   ← Strukturgebende UI-Komponenten
│   │       Header/
│   │       │   Header.tsx
│   │       │   header.module.scss
│   │       Sidebar/
│   │       │   Sidebar.tsx
│   │       │   sidebar.module.scss
│   │       Footer/
│   │           Footer.tsx
│   │           footer.module.scss
│
features/                         ← Fachliche Domänen
│   issues/
│   │   components/               ← Issue-spezifische Komponenten (gleiche Struktur: Ordner + scss)
│   │   │   IssueCard/
│   │   │   │   IssueCard.tsx
│   │   │   │   issueCard.module.scss
│   │   │   IssueList/
│   │   │       IssueList.tsx
│   │   │       issueList.module.scss
│   │   actions.ts                ← Server Functions ("use server")
│   │   queries.ts                ← DB-Abfragen (nur server-seitig)
│   │   types.ts
│   │   index.ts                  ← Barrel Export (public API)
│   projects/
│       (gleiche Struktur)
│
lib/
│   db.ts                         ← Prisma Singleton
│   auth.ts
│
types/                            ← Globale TypeScript-Typen
│   index.ts
│
prisma/
│   schema.prisma
prisma.config.ts
```

### Namenskonvention für Komponenten-Ordner

Jede Komponente bekommt einen **eigenen Ordner** mit zwei Dateien:

```
Button/
  Button.tsx          ← PascalCase für die Komponente
  button.module.scss  ← camelCase für die Styles
```

- Kein `index.ts` Barrel pro Komponente — Import direkt: `import { Button } from "@/components/ui/atoms/Button/Button"`
- `atoms/` = kleinste Einheiten (Button, Badge, Input, Icon, Spinner...)
- `layout/` = strukturgebende Hüllkomponenten (Header, Sidebar, Footer, PageWrapper...)

## Tooling

- **Bun** als Package Manager und Runner
- `bun run dev` — Dev-Server
- `bun run lint` — Biome Check
- `bun run format` — Biome Format
- `bun prisma migrate dev` — DB-Schema anwenden
- `bun prisma generate` — Prisma Client neu generieren

## Testing

- **Vitest** als Test-Runner (kein Jest)
- Konfiguration: `vitest.config.ts` im Root
- Setup-Datei: `tests/setup.ts` (mockt `server-only` global)
- Alle Tests liegen in `tests/unit/` nach Domänen aufgeteilt

### Befehle

- `bun test` — Alle Tests einmalig ausführen
- `bun run test:watch` — Tests im Watch-Modus
- `bun run test:coverage` — Tests mit Coverage-Report

### Struktur

```
tests/
  setup.ts                        ← Globale Mocks (server-only)
  unit/
    auth/
      login.test.ts               ← login() Server Action
      register.test.ts            ← register() Server Action
      logout.test.ts              ← logout() Server Action
      acceptInvitation.test.ts    ← Einladung annehmen (pending → false)
    middleware/
      middleware.test.ts          ← Auth-Middleware (JWT, Routing)
    session/
      session.test.ts             ← createSession / getSession / clearSession
    invitations/
      invitations.test.ts         ← lib/invitations (Token, Frist, Gültigkeit)
    workspace/
      createWorkspace.test.ts     ← createWorkspace() Server Action
      inviteWorkspaceMember.test.ts ← Mitglied einladen (Konto oder Link)
    projects/
      createProject.test.ts       ← createProject() Server Action
      projectMembers.test.ts      ← Projektrollen verwalten
      projectMembership.test.ts   ← lib/project-membership (Aufnahme & Austritt)
      projectSettings.test.ts     ← updateProject / deleteProject, Sichtbarkeit
    issues/
      createLabel.test.ts         ← createLabel() Server Action
      getLabels.test.ts           ← Label-Abfrage (ersetzt `react` durch Stub!)
      composerData.test.ts        ← creatableProjectIds (wo darf angelegt werden)
      rank.test.ts                ← Sortierschlüssel für Drag & Drop
    permissions/
      resolver.test.ts            ← lib/permissions (eigener Prozess, siehe unten)
      rbac.test.ts                ← Registry aus lib/rbac
      roleActions.test.ts         ← Rollenverwaltung
    table/
      tableDnd.test.tsx           ← Table mit `dnd` (components/ui/layout/Table)
    ui/
      issueCreateButtons.test.tsx ← rechteabhängige Auslöser („Neues Issue")
      permissionMatrix.test.tsx   ← Rollen-Matrix (features/roles)
    richtext/
      richText.test.tsx           ← PM-JSON-Renderer (components/ui/atoms/RichText)
      fromMarkdown.test.ts        ← Markdown → PM-JSON (Migration + Seed)
      text.test.ts                ← toPlainText / toPreview / isEmptyDoc
```

### Mocking-Konventionen

- `@/lib/db` immer mocken — kein echter DB-Zugriff in Unit Tests
- `@/lib/session` mocken wenn getestet wird, was die Session konsumiert
- `server-only` wird global in `tests/setup.ts` gemockt
- `next/headers` (`cookies`) und `jose` werden pro Datei gemockt
- SCSS-Module (`*.module.scss`) fängt ein Bun-Plugin in `tests/setup.ts` ab —
  Komponenten-Tests brauchen dafür keinen Bundler
- `vi.clearAllMocks()` in `beforeEach` — kein Zustand zwischen Tests

### Wichtig: Immer `bun run test` statt `bun test`

Bun 1.3 teilt den Modul-Cache zwischen Test-Dateien innerhalb eines Prozesses. Da
andere Test-Dateien `@/lib/session` mocken, würde dieser Mock in `session.test.ts`
durchlecken wenn alle Tests in einem einzigen `bun test`-Aufruf laufen. Dasselbe gilt
für die Richtext-Tests: `issues/getLabels.test.ts` ersetzt `react` durch einen Stub mit
nur `cache`, und `react-dom/server` verweigert dann den Dienst. Und
`permissions/roleActions.test.ts` mockt `@/lib/permissions` komplett weg — im selben
Prozess prüft `permissions/resolver.test.ts` dann den Mock statt den Resolver. Das
`test`-Script in `package.json` splittet den Aufruf deshalb in mehrere Prozesse:

Umgekehrt gilt: **kein Modul mocken, dessen eigene Tests im selben Prozess laufen.**
`auth/acceptInvitation.test.ts` prüft eine Funktion, die `lib/invitations` benutzt,
und mockt trotzdem nur `@/lib/db` — ein `mock.module("@/lib/invitations")` hätte
`invitations/invitations.test.ts` gegen den Mock testen lassen. Der DB-Mock ist die
kleinere Annahme und lässt den echten Code laufen.

```
# Korrekt:
bun run test

# NICHT direkt verwenden (Session- und Markdown-Tests schlagen fehl):
bun test
```

### CI

GitHub Actions Workflow: `.github/workflows/tests.yml`
Läuft bei jedem Push und PR auf `main`.
