# RBAC — Rollen & Berechtigungen

Dieses Dokument definiert das Role-Based Access Control (RBAC) System des Issue Trackers.
Permissions sind die atomare Einheit — Rollen sind Bündel von Permissions.

---

## Konzept

```
User → WorkspaceMember (Rolle) → Permissions
                ↓
         ProjectMember (optionale projekt-spezifische Rolle)
                ↓
         Permissions (überschreiben Workspace-Rolle für dieses Projekt)
```

**Zwei Ebenen:**
- **Workspace-Permissions** — gelten workspace-weit (Mitglieder, Teams, Settings)
- **Projekt-Permissions** — gelten pro Projekt (Issues, Labels, Kommentare)

**Vererbung:**
- Workspace-Rolle ist der Fallback, wenn keine projekt-spezifische Rolle gesetzt ist
- Eine projekt-spezifische Rolle überschreibt die Workspace-Rolle vollständig für dieses Projekt
- Owner und Admin haben implizit Zugriff auf alle Projekte — unabhängig von `ProjectMember`-Einträgen

---

## Rollen

| Rolle | ID | Beschreibung |
|---|---|---|
| **Owner** | `owner` | Workspace-Ersteller. Unveränderlich — kann nicht entfernt oder degradiert werden. Einziger mit Ownership-Transfer und finalem Workspace-Delete. |
| **Admin** | `admin` | Vollzugriff. Kann Rollen und Permissions verwalten, aber keine Ownership-Operationen. |
| **Manager** | `manager` | Verwaltet Workspace-Einstellungen, Mitglieder, Teams und Konfiguration. Kein Zugriff auf Rollen/Permissions-Schema. |
| **Project Lead** | `project_lead` | Vollzugriff auf zugewiesene Projekte. Kann eigene Projekte erstellen. Kein Workspace-Zugriff. |
| **Member** | `member` | Standardrolle. Erstellt und bearbeitet eigene Issues, kommentiert, erstellt Labels. |
| **Viewer** | `viewer` | Workspace-Mitglied mit Lesezugriff. Kann kommentieren, aber keine Issues erstellen oder bearbeiten. |
| **Guest** | `guest` | Kein Workspace-Mitglied. Wird nur zu einzelnen Projekten eingeladen. Sieht ausschließlich die explizit zugewiesenen Projekte. |

---

## Permission Scopes

### Workspace-Verwaltung

| Permission | Beschreibung |
|---|---|
| `workspace.settings.update` | Name, Farbe, Slug des Workspace ändern |
| `workspace.delete` | Workspace unwiderruflich löschen |
| `workspace.role.manage` | Rollen definieren und Permissions zuweisen (Meta-Permission) |
| `workspace.config.manage` | Status, Prioritäten, Issue-Typen workspace-weit verwalten |

### Mitglieder

| Permission | Beschreibung |
|---|---|
| `workspace.member.invite` | Einladungen an neue Mitglieder versenden |
| `workspace.member.remove` | Mitglieder aus dem Workspace entfernen |
| `workspace.member.role.update` | Rolle eines anderen Mitglieds ändern (max. eigene Rolle vergebar) |

### Projekte

| Permission | Beschreibung |
|---|---|
| `workspace.project.create` | Neues Projekt im Workspace anlegen |

### Teams

| Permission | Beschreibung |
|---|---|
| `workspace.team.create` | Team erstellen |
| `workspace.team.update` | Team-Name, Farbe und Lead ändern |
| `workspace.team.delete` | Team löschen |
| `workspace.team.member.manage` | Mitglieder zu Teams hinzufügen oder entfernen |
| `workspace.team.project.manage` | Projekte Teams zuordnen oder entfernen |

### Workspace-Labels

| Permission | Beschreibung |
|---|---|
| `workspace.label.create` | Workspace-weites Label anlegen |
| `workspace.label.update` | Workspace-Label bearbeiten |
| `workspace.label.delete` | Workspace-Label löschen |

### Audit

| Permission | Beschreibung |
|---|---|
| `workspace.audit.view` | Audit-Log einsehen (wer hat was wann geändert) |

---

### Projekt-Verwaltung

| Permission | Beschreibung |
|---|---|
| `project.view` | Projekt sehen (relevant für private Projekte) |
| `project.settings.update` | Projektname, Präfix und Farbe ändern |
| `project.delete` | Projekt löschen |
| `project.member.manage` | Projekt-spezifische Rollen vergeben (inkl. Guests einladen) |

### Issues

| Permission | Beschreibung |
|---|---|
| `project.issue.create` | Issue im Projekt erstellen |
| `project.issue.update.any` | Beliebige Issues bearbeiten (Titel, Beschreibung, Felder) |
| `project.issue.update.own` | Nur eigene Issues bearbeiten (Reporter oder Assignee) |
| `project.issue.delete.any` | Beliebige Issues löschen |
| `project.issue.delete.own` | Nur eigene Issues löschen |
| `project.issue.assign` | Issues anderen Mitgliedern zuweisen |

### Kommentare

| Permission | Beschreibung |
|---|---|
| `project.comment.create` | Kommentar zu einem Issue schreiben |
| `project.comment.delete.any` | Beliebige Kommentare löschen |
| `project.comment.delete.own` | Nur eigene Kommentare löschen |

### Projekt-Labels

| Permission | Beschreibung |
|---|---|
| `project.label.create` | Projekt-spezifisches Label anlegen |
| `project.label.update` | Projekt-Label bearbeiten |
| `project.label.delete` | Projekt-Label löschen |

---

## Rollen-Matrix

> ✓ = Permission enthalten · — = nicht enthalten

| Permission | Owner | Admin | Manager | Project Lead | Member | Viewer | Guest |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Workspace** | | | | | | | |
| `workspace.settings.update` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.delete` | ✓ | — | — | — | — | — | — |
| `workspace.role.manage` | ✓ | ✓ | — | — | — | — | — |
| `workspace.config.manage` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.audit.view` | ✓ | ✓ | ✓ | — | — | — | — |
| **Mitglieder** | | | | | | | |
| `workspace.member.invite` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.member.remove` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.member.role.update` | ✓ | ✓ | ✓ | — | — | — | — |
| **Projekte** | | | | | | | |
| `workspace.project.create` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| **Teams** | | | | | | | |
| `workspace.team.create` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.team.update` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.team.delete` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.team.member.manage` | ✓ | ✓ | ✓ | — | — | — | — |
| `workspace.team.project.manage` | ✓ | ✓ | ✓ | — | — | — | — |
| **Workspace-Labels** | | | | | | | |
| `workspace.label.create` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `workspace.label.update` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `workspace.label.delete` | ✓ | ✓ | ✓ | — | — | — | — |
| **Projekt-Verwaltung** | | | | | | | |
| `project.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (nur zugewiesene) |
| `project.settings.update` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `project.delete` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `project.member.manage` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| **Issues** | | | | | | | |
| `project.issue.create` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `project.issue.update.any` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `project.issue.update.own` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `project.issue.delete.any` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `project.issue.delete.own` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `project.issue.assign` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| **Kommentare** | | | | | | | |
| `project.comment.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.comment.delete.any` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `project.comment.delete.own` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Projekt-Labels** | | | | | | | |
| `project.label.create` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `project.label.update` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `project.label.delete` | ✓ | ✓ | ✓ | ✓ | — | — | — |

---

## Was zu beachten ist

### Owner-Schutz

- Es gibt immer **genau einen Owner** pro Workspace
- Der Owner kann **nicht entfernt** werden — auch nicht von Admins
- Ownership kann nur der Owner selbst übertragen (`workspace.delete` und Transfer sind Owner-exklusiv)
- Bei Workspace-Erstellung wird der Ersteller automatisch Owner
- **Kein Fallback ohne Owner:** Ownership-Transfer muss erzwungen werden, bevor ein Owner den Workspace verlässt

### Rollen-Vergabe-Beschränkung

Ein Mitglied kann einer anderen Person **maximal die eigene Rolle** vergeben — nie eine höhere:
- Ein Manager kann Members, Viewers und Guests verwalten, aber keinen neuen Admin ernennen
- Nur Owner und Admins können Admins und Manager ernennen
- Diese Logik wird **in der Server Action** geprüft, nicht nur im UI

### Projekt-Sichtbarkeit (privat vs. öffentlich)

- **Öffentliches Projekt:** Alle Workspace-Mitglieder haben automatisch `project.view` (gemäß ihrer Workspace-Rolle)
- **Privates Projekt:** Nur explizite `ProjectMember`-Einträge gewähren Zugang — Workspace-Rolle reicht nicht
- Owner und Admin sehen **immer alle** Projekte, unabhängig von `ProjectMember`-Einträgen
- `project.view` fehlt → Projekt erscheint nicht in der Liste und alle Routen geben 404/403 zurück

### Guest-Besonderheiten

- Guests haben **keinen** `WorkspaceMember`-Eintrag — nur `ProjectMember`-Einträge
- Guests sehen nicht: Mitgliederliste, Workspace-Settings, andere Projekte, Teams
- Guests können Kommentare schreiben und löschen (eigene) — aber keine Issues erstellen
- Einladung von Guests erfolgt über `project.member.manage` (Project Lead oder höher)
- Wenn ein Guest zu mehreren Projekten eingeladen wird, bleibt er trotzdem kein Workspace-Mitglied

### Projekt-spezifische Rollen

- Ein Workspace-Member kann in Projekt A als `project_lead` agieren und in Projekt B nur als `viewer`
- Projekt-spezifische Rollen überschreiben die Workspace-Rolle **vollständig** für dieses Projekt
- Kein `ProjectMember`-Eintrag → Workspace-Rolle gilt als Fallback (nur bei öffentlichen Projekten)

### Enforcement-Ebenen

Berechtigungen müssen auf **zwei Ebenen** geprüft werden — UI-only reicht nicht:

```
1. Server Action / Route Handler   ← Pflicht, hier wird tatsächlich geblockt
2. UI (Buttons verstecken)         ← Optional, nur für UX
```

Aktuell sind alle Server Actions ungesichert. Jede Action braucht einen Guard:

```ts
// Beispiel-Pattern für Server Actions
async function deleteIssue(issueId: string) {
  await requirePermission('project.issue.delete.any', { projectId })
  // ... oder
  await requirePermissionOr([
    { permission: 'project.issue.delete.any', context: { projectId } },
    { permission: 'project.issue.delete.own', context: { projectId }, ownerId: issue.reporterId },
  ])
}
```

### `.own` vs. `.any` Qualifier

Permissions mit `.own` gelten wenn der User **Reporter oder Assignee** des Issues ist.
Die Prüfung lädt den Issue aus der DB und vergleicht — nicht aus dem Client-State:

```
own = issue.reporterId === userId || issue.assigneeId === userId
```

### Rollen in der DB vs. hardcoded

- Die 7 Default-Rollen sind **Seed-Daten** — nicht hardcoded im Code
- Admins können über `workspace.role.manage` eigene Rollen erstellen
- Permission-Strings (`workspace.settings.update` etc.) sind hardcoded im Code als Enum/Constants
- Neue Permissions erfordern einen Code-Deploy, neue Rollen nicht

### Migrations-Reihenfolge

Bei der Implementierung unbedingt diese Reihenfolge einhalten:

```
1. Schema erweitern (Permission, RolePermission, ProjectMember)
2. Migration + Seed mit Default-Rollen und Permissions
3. lib/permissions.ts mit requirePermission() implementieren
4. Alle Server Actions mit Guards absichern
5. UI anpassen (Buttons, sichtbare Elemente)
6. Bestehende WorkspaceMember.role migrieren → neue Rollen-IDs
```

Schritt 6 ist kritisch: bestehende `"admin"` / `"member"` / `"viewer"` Strings in `WorkspaceMember.role`
müssen auf die neuen Rollen-IDs gemappt werden, bevor der alte Code entfernt wird.
