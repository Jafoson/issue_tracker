import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { provisionWorkspaceRbac } from "../lib/rbac-provision";
import { uid } from "../lib/utils/id";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const WS = "nimbus";

// Bootstrap: erster Plattform-Admin (SaaS-Betreiber-Ebene über allen Workspaces).
// u1 (Mara) wird global zum Plattform-Admin ernannt. Hat keinen Durchgriff auf
// Tenant-Inhalte, nur auf Plattform-Operationen.
const PLATFORM_ADMIN_IDS = new Set(["u1"]);

// ─── Workspace Config ─────────────────────────────────────────────────────────

const STATUSES = [
  {
    id: "backlog",
    name: "Backlog",
    short: "Backlog",
    color: "#8a9099",
    isColumn: true,
    position: 0,
  },
  {
    id: "todo",
    name: "Todo",
    short: "Todo",
    color: "#b8bcc4",
    isColumn: true,
    position: 1,
  },
  {
    id: "in_progress",
    name: "In Progress",
    short: "Progress",
    color: "#e2b340",
    isColumn: true,
    position: 2,
  },
  {
    id: "in_review",
    name: "In Review",
    short: "Review",
    color: "#5b9bd5",
    isColumn: true,
    position: 3,
  },
  {
    id: "done",
    name: "Done",
    short: "Done",
    color: "#5ab98a",
    isColumn: true,
    position: 4,
  },
  {
    id: "canceled",
    name: "Canceled",
    short: "Canceled",
    color: "#7a7f87",
    isColumn: false,
    position: 5,
  },
];

const PRIORITIES = [
  { id: 0, key: "none", name: "No priority", color: "#8a9099", position: 0 },
  { id: 1, key: "low", name: "Low", color: "#3b9d6e", position: 1 },
  { id: 2, key: "medium", name: "Medium", color: "#e2b340", position: 2 },
  { id: 3, key: "high", name: "High", color: "#d5733b", position: 3 },
  { id: 4, key: "urgent", name: "Urgent", color: "#e05252", position: 4 },
];

const ISSUE_TYPES = [
  { id: "feature", name: "Feature", color: "#6e63e6", position: 0 },
  { id: "bug", name: "Bug", color: "#e5664a", position: 1 },
  { id: "improvement", name: "Improvement", color: "#3b9d6e", position: 2 },
  { id: "task", name: "Task", color: "#3b7bd5", position: 3 },
  { id: "chore", name: "Chore", color: "#8a7f6b", position: 4 },
];

const LABELS = [
  { id: "l1", workspaceId: WS, name: "Bug", slug: "bug", color: "#e5664a" },
  {
    id: "l2",
    workspaceId: WS,
    name: "Feature",
    slug: "feature",
    color: "#6e63e6",
  },
  {
    id: "l3",
    workspaceId: WS,
    name: "Improvement",
    slug: "improvement",
    color: "#3b9d6e",
  },
  {
    id: "l4",
    workspaceId: WS,
    name: "Design",
    slug: "design",
    color: "#cf6fb0",
  },
  {
    id: "l5",
    workspaceId: WS,
    name: "Frontend",
    slug: "frontend",
    color: "#3b7bd5",
  },
  {
    id: "l6",
    workspaceId: WS,
    name: "Backend",
    slug: "backend",
    color: "#c2904a",
  },
  {
    id: "l7",
    workspaceId: WS,
    name: "Tech Debt",
    slug: "tech-debt",
    color: "#8a7f6b",
  },
  {
    id: "l8",
    workspaceId: WS,
    name: "Customer",
    slug: "customer",
    color: "#d5733b",
  },
  { id: "l9", workspaceId: WS, name: "Docs", slug: "docs", color: "#5aa0a0" },
];

// ─── Seed Data ───────────────────────────────────────────────────────────────

const USERS = [
  {
    id: "u1",
    firstName: "Mara",
    lastName: "Velez",
    handle: "mara",
    email: "mara@nimbus.io",
    color: "#6e63e6",
  },
  {
    id: "u2",
    firstName: "Tomas",
    lastName: "Køhler",
    handle: "tomas",
    email: "tomas@nimbus.io",
    color: "#d5733b",
  },
  {
    id: "u3",
    firstName: "Aisha",
    lastName: "Rahman",
    handle: "aisha",
    email: "aisha@nimbus.io",
    color: "#3b9d6e",
  },
  {
    id: "u4",
    firstName: "Devon",
    lastName: "Park",
    handle: "devon",
    email: "devon@nimbus.io",
    color: "#c2456b",
  },
  {
    id: "u5",
    firstName: "Lena",
    lastName: "Brandt",
    handle: "lena",
    email: "lena@nimbus.io",
    color: "#3b7bd5",
  },
  {
    id: "u6",
    firstName: "Yusuf",
    lastName: "Demir",
    handle: "yusuf",
    email: "yusuf@nimbus.io",
    color: "#a05fd0",
  },
  {
    id: "u7",
    firstName: "Priya",
    lastName: "Nair",
    handle: "priya",
    email: "priya@nimbus.io",
    color: "#cf9a3b",
  },
];

const WORKSPACE_MEMBERS = [
  { workspaceId: WS, userId: "u1", role: "owner", pending: false },
  { workspaceId: WS, userId: "u2", role: "member", pending: false },
  { workspaceId: WS, userId: "u3", role: "member", pending: false },
  { workspaceId: WS, userId: "u4", role: "member", pending: false },
  { workspaceId: WS, userId: "u5", role: "admin", pending: false },
  { workspaceId: WS, userId: "u6", role: "member", pending: false },
  { workspaceId: WS, userId: "u7", role: "viewer", pending: false },
];

const PROJECTS = [
  {
    id: "p1",
    workspaceId: WS,
    name: "Web App",
    slug: "web-app",
    prefix: "NIM",
    color: "#6e63e6",
  },
  {
    id: "p2",
    workspaceId: WS,
    name: "Mobile",
    slug: "mobile",
    prefix: "MOB",
    color: "#3b9d6e",
  },
  {
    id: "p3",
    workspaceId: WS,
    name: "Platform",
    slug: "platform",
    prefix: "PLT",
    color: "#d5733b",
  },
];

const TEAMS = [
  {
    id: "t1",
    workspaceId: WS,
    name: "Web Platform",
    key: "WEB",
    color: "#6e63e6",
    lead: "u1",
    members: ["u1", "u2", "u3", "u6"],
    projects: ["p1"],
    desc: "Owns the web app, board experience and core UX.",
  },
  {
    id: "t2",
    workspaceId: WS,
    name: "Mobile",
    key: "MOB",
    color: "#3b9d6e",
    lead: "u5",
    members: ["u5", "u4", "u7"],
    projects: ["p2"],
    desc: "iOS & Android apps and shared mobile tooling.",
  },
  {
    id: "t3",
    workspaceId: WS,
    name: "Infrastructure",
    key: "INF",
    color: "#d5733b",
    lead: "u6",
    members: ["u6", "u3", "u5"],
    projects: ["p3"],
    desc: "APIs, billing, webhooks and reliability.",
  },
];

const H = 3_600_000;
const D = 24 * H;
const ago = (ms: number) => new Date(Date.now() - ms);

const projectOf: Record<string, string> = {
  i1: "p1",
  i2: "p1",
  i3: "p1",
  i5: "p1",
  i6: "p1",
  i8: "p1",
  i9: "p1",
  i11: "p1",
  i17: "p1",
  i22: "p1",
  i24: "p1",
  i14: "p2",
  i7: "p2",
  i13: "p2",
  i15: "p2",
  i19: "p2",
  i4: "p3",
  i10: "p3",
  i12: "p3",
  i16: "p3",
  i18: "p3",
  i20: "p3",
  i21: "p3",
  i23: "p3",
};
const typeOf: Record<string, string> = {
  i1: "bug",
  i2: "feature",
  i3: "improvement",
  i4: "bug",
  i5: "bug",
  i6: "feature",
  i7: "feature",
  i8: "feature",
  i9: "improvement",
  i10: "bug",
  i11: "feature",
  i12: "bug",
  i13: "feature",
  i14: "bug",
  i15: "feature",
  i16: "improvement",
  i17: "feature",
  i18: "feature",
  i19: "feature",
  i20: "feature",
  i21: "chore",
  i22: "bug",
  i23: "feature",
  i24: "feature",
};

const ISSUES = [
  {
    id: "i1",
    key: 142,
    title: "OAuth callback drops session on Safari 17",
    status: "in_progress",
    priority: 4,
    assignee: "u3",
    reporter: "u1",
    labels: ["l1", "l5"],
    created: ago(6 * D),
    updated: ago(2 * H),
    desc: "Users on **Safari 17** are logged out immediately after the OAuth redirect completes.\n\n### Steps to reproduce\n1. Open the app in Safari 17\n2. Click **Sign in with Google**\n3. Complete the consent screen\n\n### Expected\nSession persists and the dashboard loads.\n\n### Actual\nRedirect lands on `/login` again. The `session` cookie is missing the `SameSite=None` attribute.\n\n> Likely related to the ITP cookie partitioning change.",
    comments: [
      {
        id: "c1",
        author: "u1",
        time: ago(5 * D),
        body: "Can repro on my iPhone too — only Safari, Chrome is fine.",
      },
      {
        id: "c2",
        author: "u3",
        time: ago(3 * H),
        body: "Found it: we set the cookie before the redirect resolves. Moving it into the callback handler. PR up shortly.",
      },
    ],
  },
  {
    id: "i2",
    key: 138,
    title: "Add keyboard shortcuts for status changes",
    status: "todo",
    priority: 2,
    assignee: "u2",
    reporter: "u5",
    labels: ["l2", "l5"],
    created: ago(9 * D),
    updated: ago(1 * D),
    desc: "Power users want to move issues without the mouse.\n\n- `1–5` sets priority\n- `s` opens the status menu\n- `a` opens the assignee menu\n\nMirror the command palette grammar so muscle memory transfers.",
    comments: [],
  },
  {
    id: "i3",
    key: 151,
    title: "Board column virtualization for 500+ cards",
    status: "backlog",
    priority: 3,
    assignee: "u6",
    reporter: "u1",
    labels: ["l3", "l7", "l5"],
    created: ago(3 * D),
    updated: ago(3 * D),
    desc: "Large workspaces stutter when a column holds hundreds of cards.\n\nWe should virtualize the column list and only render the visible window. Keep drag-and-drop working across the virtualized boundary.",
    comments: [
      {
        id: "c3",
        author: "u6",
        time: ago(2 * D),
        body: "I'd benchmark with a synthetic 2k-issue workspace before we pick a windowing lib.",
      },
    ],
  },
  {
    id: "i4",
    key: 129,
    title: "Stripe webhook retries create duplicate invoices",
    status: "in_review",
    priority: 4,
    assignee: "u5",
    reporter: "u4",
    labels: ["l1", "l6", "l8"],
    created: ago(12 * D),
    updated: ago(5 * H),
    desc: "When Stripe retries a `invoice.paid` webhook, we occasionally insert a second invoice row.\n\n**Fix:** make the handler idempotent using the Stripe event id as a dedupe key.",
    comments: [
      {
        id: "c4",
        author: "u4",
        time: ago(11 * D),
        body: "Customer Acme hit this twice this month. Bumping priority.",
      },
      {
        id: "c5",
        author: "u5",
        time: ago(6 * H),
        body: "Added a unique constraint on event_id + a guard. In review.",
      },
    ],
  },
  {
    id: "i5",
    key: 160,
    title: "Dark mode contrast fails WCAG on muted text",
    status: "todo",
    priority: 2,
    assignee: "u4",
    reporter: "u3",
    labels: ["l4", "l5"],
    created: ago(2 * D),
    updated: ago(20 * H),
    desc: "Secondary text (`--text-3`) sits at ~3.1:1 against the panel background. Needs to clear **4.5:1** for body text.\n\nProposing a slightly lighter muted token in dark mode.",
    comments: [],
  },
  {
    id: "i6",
    key: 118,
    title: "Bulk-edit selected issues from the list view",
    status: "backlog",
    priority: 1,
    assignee: "u1",
    reporter: "u1",
    labels: ["l2"],
    created: ago(15 * D),
    updated: ago(7 * D),
    desc: "Shift-select rows, then change status / assignee / labels for all of them at once.",
    comments: [],
  },
  {
    id: "i7",
    key: 165,
    title: "Export board to CSV and Markdown",
    status: "backlog",
    priority: 1,
    assignee: "u7",
    reporter: "u2",
    labels: ["l2", "l9"],
    created: ago(1 * D),
    updated: ago(1 * D),
    desc: "Let teams export a filtered view. Start with CSV, add Markdown table later.",
    comments: [],
  },
  {
    id: "i8",
    key: 144,
    title: "Realtime presence avatars on shared boards",
    status: "in_progress",
    priority: 2,
    assignee: "u6",
    reporter: "u5",
    labels: ["l2", "l5"],
    created: ago(5 * D),
    updated: ago(8 * H),
    desc: "Show who else is viewing a board, like cursors-lite.\n\n- Avatar stack in the top-right\n- Soft pulse when someone joins\n- Powered by the existing websocket channel",
    comments: [
      {
        id: "c6",
        author: "u5",
        time: ago(1 * D),
        body: "Let's cap the stack at 5 + an overflow counter.",
      },
    ],
  },
  {
    id: "i9",
    key: 101,
    title: "Onboarding: empty states feel cold",
    status: "done",
    priority: 2,
    assignee: "u4",
    reporter: "u1",
    labels: ["l4", "l3"],
    created: ago(28 * D),
    updated: ago(9 * D),
    desc: "Replace the blank board with a friendly first-run checklist and a sample project.",
    comments: [
      {
        id: "c7",
        author: "u4",
        time: ago(10 * D),
        body: "Shipped the illustrated empty states + sample data toggle.",
      },
    ],
  },
  {
    id: "i10",
    key: 133,
    title: "Slow query on /issues when filtering by label",
    status: "done",
    priority: 3,
    assignee: "u3",
    reporter: "u6",
    labels: ["l1", "l6", "l7"],
    created: ago(20 * D),
    updated: ago(11 * D),
    desc: "Missing composite index on `(workspace_id, label_id)`. Added it; p95 dropped from 900ms to 60ms.",
    comments: [],
  },
  {
    id: "i11",
    key: 157,
    title: "Markdown editor: support task checkboxes",
    status: "todo",
    priority: 2,
    assignee: "u2",
    reporter: "u3",
    labels: ["l2", "l5"],
    created: ago(4 * D),
    updated: ago(2 * D),
    desc: "Render `- [ ]` and `- [x]` as interactive checkboxes inside the description.",
    comments: [],
  },
  {
    id: "i12",
    key: 149,
    title: "Notification digest emails go out at 3am UTC",
    status: "in_progress",
    priority: 3,
    assignee: "u5",
    reporter: "u7",
    labels: ["l1", "l6"],
    created: ago(6 * D),
    updated: ago(12 * H),
    desc: "Digests should respect the recipient's timezone, not the server's. Schedule per-user.",
    comments: [],
  },
  {
    id: "i13",
    key: 170,
    title: "Add 'Urgent' SLA timer to issue cards",
    status: "backlog",
    priority: 3,
    assignee: "u1",
    reporter: "u4",
    labels: ["l2", "l8"],
    created: ago(1 * D),
    updated: ago(1 * D),
    desc: "When an issue is Urgent, show a countdown to the SLA breach on the card.",
    comments: [],
  },
  {
    id: "i14",
    key: 122,
    title: "Drag-and-drop fails on touch devices",
    status: "in_review",
    priority: 3,
    assignee: "u6",
    reporter: "u2",
    labels: ["l1", "l5"],
    created: ago(10 * D),
    updated: ago(4 * H),
    desc: "Touch drag doesn't pick up cards on iPad. Need pointer-events fallback with a long-press to grab.",
    comments: [
      {
        id: "c8",
        author: "u6",
        time: ago(5 * H),
        body: "Switched to Pointer Events with a 180ms long-press threshold. Feels good on iPad now.",
      },
    ],
  },
  {
    id: "i15",
    key: 168,
    title: "Saved filter views per project",
    status: "todo",
    priority: 1,
    assignee: "u7",
    reporter: "u1",
    labels: ["l2"],
    created: ago(2 * D),
    updated: ago(1 * D),
    desc: "Let users name and pin a filter combination as a view in the sidebar.",
    comments: [],
  },
  {
    id: "i16",
    key: 155,
    title: "Avatar uploads not resized server-side",
    status: "done",
    priority: 1,
    assignee: "u3",
    reporter: "u5",
    labels: ["l1", "l6"],
    created: ago(14 * D),
    updated: ago(8 * D),
    desc: "Full-res uploads bloat storage. Resize to 256px on upload and strip EXIF.",
    comments: [],
  },
  {
    id: "i17",
    key: 173,
    title: "Command palette: fuzzy search for issues",
    status: "in_progress",
    priority: 2,
    assignee: "u1",
    reporter: "u1",
    labels: ["l2", "l5"],
    created: ago(3 * D),
    updated: ago(1 * H),
    desc: "Typing in ⌘K should match issue IDs and titles with a forgiving fuzzy matcher.",
    comments: [],
  },
  {
    id: "i18",
    key: 110,
    title: "Audit log for permission changes",
    status: "backlog",
    priority: 2,
    assignee: "u1",
    reporter: "u5",
    labels: ["l2", "l6"],
    created: ago(18 * D),
    updated: ago(16 * D),
    desc: "Track who changed a member's role and when. Admin-only view.",
    comments: [],
  },
  {
    id: "i19",
    key: 162,
    title: "Inline label creation from the issue panel",
    status: "todo",
    priority: 1,
    assignee: "u4",
    reporter: "u3",
    labels: ["l3", "l4"],
    created: ago(3 * D),
    updated: ago(2 * D),
    desc: "Type a new label name in the label menu and create it on the fly with a random color.",
    comments: [],
  },
  {
    id: "i20",
    key: 147,
    title: "Webhook signing secret rotation",
    status: "in_review",
    priority: 2,
    assignee: "u6",
    reporter: "u4",
    labels: ["l6"],
    created: ago(8 * D),
    updated: ago(6 * H),
    desc: "Support two active signing secrets during a rotation window to avoid downtime.",
    comments: [],
  },
  {
    id: "i21",
    key: 175,
    title: "Cancelled: migrate to GraphQL gateway",
    status: "canceled",
    priority: 1,
    assignee: "u5",
    reporter: "u1",
    labels: ["l7", "l6"],
    created: ago(25 * D),
    updated: ago(13 * D),
    desc: "Decided to stay on REST + tRPC for now. Revisit next quarter.",
    comments: [],
  },
  {
    id: "i22",
    key: 158,
    title: "Sidebar collapse state not persisted",
    status: "todo",
    priority: 1,
    assignee: "u2",
    reporter: "u7",
    labels: ["l1", "l5"],
    created: ago(2 * D),
    updated: ago(1 * D),
    desc: "Collapsing the sidebar resets on reload. Persist to localStorage.",
    comments: [],
  },
  {
    id: "i23",
    key: 166,
    title: "AI: suggest labels from issue title",
    status: "backlog",
    priority: 2,
    assignee: "u6",
    reporter: "u1",
    labels: ["l2", "l3"],
    created: ago(1 * D),
    updated: ago(1 * D),
    desc: "When creating an issue, suggest likely labels based on the title text.",
    comments: [],
  },
  {
    id: "i24",
    key: 140,
    title: "Comment editing & @mentions",
    status: "in_progress",
    priority: 2,
    assignee: "u1",
    reporter: "u4",
    labels: ["l2", "l5"],
    created: ago(7 * D),
    updated: ago(3 * H),
    desc: "Allow editing posted comments and @mentioning teammates to notify them.",
    comments: [
      {
        id: "c9",
        author: "u4",
        time: ago(2 * D),
        body: "Mentions should trigger a notification + email if offline.",
      },
    ],
  },
];

// ─── ID-Mapping ───────────────────────────────────────────────────────────────
//
// Die obigen Datensätze referenzieren sich gegenseitig über kurze, lesbare
// Handles ("u1", "p1", "l1", "i1", "c1", "t1"). Diese sind NUR seed-interne
// Schlüssel — in die DB schreiben wir echte, nicht-erratbare IDs, die mit
// derselben uid()-Funktion erzeugt werden wie in den Server Actions
// (lib/utils/id.ts → Präfix + crypto.randomUUID()). Das verhindert, dass die
// DB vorhersagbare/aufzählbare IDs enthält (IDOR-Schutz).
//
// Semantische IDs bleiben bewusst stabil, weil sie im Code als Werte genutzt
// werden: Status.id ("backlog"…), IssueType.id ("feature"…), Priority.id (0…4),
// der Workspace-Slug und die Role-Keys.

const realUserId = new Map(USERS.map((u) => [u.id, uid("u")]));
const realProjectId = new Map(PROJECTS.map((p) => [p.id, uid("p")]));
const realLabelId = new Map(LABELS.map((l) => [l.id, uid("l")]));
const realTeamId = new Map(TEAMS.map((t) => [t.id, uid("t")]));
const realIssueId = new Map(ISSUES.map((i) => [i.id, uid("i")]));
const realCommentId = new Map(
  ISSUES.flatMap((i) => i.comments.map((c) => [c.id, uid("c")] as const)),
);

// Lookups, die hart fehlschlagen statt eine kaputte Referenz zu schreiben.
const ref = <K>(map: Map<K, string>, key: K, what: string): string => {
  const id = map.get(key);
  if (!id) throw new Error(`Seed: ${what} "${String(key)}" nicht gemappt`);
  return id;
};

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding database…");

  // Sauber aufräumen: Mit zufälligen IDs ist Upsert-nach-id nicht mehr
  // idempotent, ein erneuter Lauf würde sonst Duplikate erzeugen. In
  // FK-sicherer Reihenfolge löschen (Kinder vor Eltern).
  await db.comment.deleteMany();
  await db.issue.deleteMany();
  await db.teamMember.deleteMany();
  await db.teamProject.deleteMany();
  await db.projectMember.deleteMany();
  await db.team.deleteMany();
  await db.label.deleteMany();
  await db.rolePermission.deleteMany();
  await db.role.deleteMany();
  await db.workspaceMember.deleteMany();
  await db.workspaceStatus.deleteMany();
  await db.workspacePriority.deleteMany();
  await db.workspaceIssueType.deleteMany();
  await db.project.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();
  await db.permission.deleteMany();
  await db.status.deleteMany();
  await db.priority.deleteMany();
  await db.issueType.deleteMany();
  console.log("   ✓ cleaned existing rows");

  await db.workspace.upsert({
    where: { id: WS },
    update: { name: "Nimbus" },
    create: { id: WS, name: "Nimbus", color: "#6e63e6", slug: "nimbus" },
  });
  console.log("   ✓ 1 workspace");

  for (const s of STATUSES) {
    await db.status.upsert({ where: { id: s.id }, update: s, create: s });
    await db.workspaceStatus.upsert({
      where: { workspaceId_statusId: { workspaceId: WS, statusId: s.id } },
      update: {},
      create: { workspaceId: WS, statusId: s.id },
    });
  }
  console.log(`   ✓ ${STATUSES.length} statuses`);

  for (const p of PRIORITIES) {
    await db.priority.upsert({ where: { id: p.id }, update: p, create: p });
    await db.workspacePriority.upsert({
      where: { workspaceId_priorityId: { workspaceId: WS, priorityId: p.id } },
      update: {},
      create: { workspaceId: WS, priorityId: p.id },
    });
  }
  console.log(`   ✓ ${PRIORITIES.length} priorities`);

  for (const t of ISSUE_TYPES) {
    await db.issueType.upsert({ where: { id: t.id }, update: t, create: t });
    await db.workspaceIssueType.upsert({
      where: {
        workspaceId_issueTypeId: { workspaceId: WS, issueTypeId: t.id },
      },
      update: {},
      create: { workspaceId: WS, issueTypeId: t.id },
    });
  }
  console.log(`   ✓ ${ISSUE_TYPES.length} issue types`);

  await provisionWorkspaceRbac(db, WS);
  console.log("   ✓ RBAC roles & permissions");

  for (const u of USERS) {
    const id = ref(realUserId, u.id, "user");
    await db.user.upsert({
      where: { id },
      update: {
        globalRole: PLATFORM_ADMIN_IDS.has(u.id) ? "admin" : "member",
      },
      create: {
        id,
        firstName: u.firstName,
        lastName: u.lastName,
        handle: u.handle,
        email: u.email,
        color: u.color,
        globalRole: PLATFORM_ADMIN_IDS.has(u.id) ? "admin" : "member",
      },
    });
  }
  console.log(`   ✓ ${USERS.length} users`);

  for (const m of WORKSPACE_MEMBERS) {
    const userId = ref(realUserId, m.userId, "member user");
    await db.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: m.workspaceId, userId },
      },
      update: { role: m.role, pending: m.pending },
      create: {
        workspaceId: m.workspaceId,
        userId,
        role: m.role,
        pending: m.pending,
      },
    });
  }
  console.log(`   ✓ ${WORKSPACE_MEMBERS.length} workspace members`);

  for (const p of PROJECTS) {
    const id = ref(realProjectId, p.id, "project");
    await db.project.upsert({
      where: { id },
      update: {},
      create: {
        id,
        workspaceId: p.workspaceId,
        name: p.name,
        slug: p.slug,
        prefix: p.prefix,
        color: p.color,
      },
    });
  }
  console.log(`   ✓ ${PROJECTS.length} projects`);

  for (const l of LABELS) {
    const id = ref(realLabelId, l.id, "label");
    await db.label.upsert({
      where: { id },
      update: {},
      create: {
        id,
        workspaceId: l.workspaceId,
        name: l.name,
        slug: l.slug,
        color: l.color,
      },
    });
  }
  console.log(`   ✓ ${LABELS.length} labels`);

  for (const t of TEAMS) {
    const teamId = ref(realTeamId, t.id, "team");
    await db.team.upsert({
      where: { id: teamId },
      update: {},
      create: {
        id: teamId,
        workspaceId: t.workspaceId,
        name: t.name,
        key: t.key,
        color: t.color,
        desc: t.desc,
        leadId: ref(realUserId, t.lead, "team lead"),
      },
    });
    for (const member of t.members) {
      const userId = ref(realUserId, member, "team member");
      await db.teamMember.upsert({
        where: { teamId_userId: { teamId, userId } },
        update: {},
        create: { teamId, userId },
      });
    }
    for (const project of t.projects) {
      const projectId = ref(realProjectId, project, "team project");
      await db.teamProject.upsert({
        where: { teamId_projectId: { teamId, projectId } },
        update: {},
        create: { teamId, projectId },
      });
    }
  }
  console.log(`   ✓ ${TEAMS.length} teams`);

  // Assign per-project keys starting at 1 (in array order) and track the
  // highest key per project so the project counter can be persisted below.
  const keyCounter: Record<string, number> = {};
  for (const issue of ISSUES) {
    const localProject = projectOf[issue.id] ?? "p1";
    keyCounter[localProject] = (keyCounter[localProject] ?? 0) + 1;
    const key = keyCounter[localProject];
    const issueId = ref(realIssueId, issue.id, "issue");
    await db.issue.upsert({
      where: { id: issueId },
      update: {},
      create: {
        id: issueId,
        key,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        description: issue.desc,
        type: typeOf[issue.id] ?? "feature",
        labels: issue.labels.map((l) => ref(realLabelId, l, "issue label")),
        created: issue.created,
        updated: issue.updated,
        assigneeId: issue.assignee
          ? ref(realUserId, issue.assignee, "assignee")
          : null,
        reporterId: ref(realUserId, issue.reporter, "reporter"),
        projectId: ref(realProjectId, localProject, "issue project"),
      },
    });
    for (const c of issue.comments) {
      await db.comment.upsert({
        where: { id: ref(realCommentId, c.id, "comment") },
        update: {},
        create: {
          id: ref(realCommentId, c.id, "comment"),
          body: c.body,
          created: c.time,
          issueId,
          authorId: ref(realUserId, c.author, "comment author"),
        },
      });
    }
  }
  // Persist the counter so newly created issues continue after the seed data.
  for (const [localProject, last] of Object.entries(keyCounter)) {
    await db.project.update({
      where: { id: ref(realProjectId, localProject, "counter project") },
      data: { lastIssueKey: last },
    });
  }
  console.log(`   ✓ ${ISSUES.length} issues`);

  console.log("✅  Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
