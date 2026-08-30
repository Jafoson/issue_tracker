export const DEFAULT_STATUSES = [
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

export const DEFAULT_PRIORITIES = [
  { id: 0, key: "none", name: "No priority", color: "#8a9099", position: 0 },
  { id: 1, key: "low", name: "Low", color: "#3b9d6e", position: 1 },
  { id: 2, key: "medium", name: "Medium", color: "#e2b340", position: 2 },
  { id: 3, key: "high", name: "High", color: "#d5733b", position: 3 },
  { id: 4, key: "urgent", name: "Urgent", color: "#e05252", position: 4 },
];

export const DEFAULT_ISSUE_TYPES = [
  { id: "feature", name: "Feature", color: "#6e63e6", position: 0 },
  { id: "bug", name: "Bug", color: "#e5664a", position: 1 },
  { id: "improvement", name: "Improvement", color: "#3b9d6e", position: 2 },
  { id: "task", name: "Task", color: "#3b7bd5", position: 3 },
  { id: "chore", name: "Chore", color: "#8a7f6b", position: 4 },
];

/**
 * The statuses that count an issue as done — completed or canceled.
 * Everything else is open.
 *
 * Lives here instead of being repeated three times separately, because more
 * hangs off it than a count: `Issue.closedAt` gets set and cleared at
 * exactly this boundary (`features/issues/actions.ts`), and the dashboard
 * measures throughput and cycle time against it. Two lists drifting apart
 * would mean: an issue counts as open while still carrying a completion
 * date.
 *
 * Canceled counts too. A canceled issue isn't an accomplishment, but it's
 * also no longer work — if it kept counting toward the backlog, that
 * backlog would grow by exactly what someone deliberately cleared away.
 */
export const CLOSED_STATUSES = ["done", "canceled"] as const;

export function isClosedStatus(status: string): boolean {
  return (CLOSED_STATUSES as readonly string[]).includes(status);
}

// Default roles & permissions live in lib/rbac.ts (single source of truth)
// and are created per workspace via lib/rbac-provision.ts.
