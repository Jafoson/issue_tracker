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
