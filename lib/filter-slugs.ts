import type { Label, Priority, User } from "@/types";

/**
 * Filter values live in the URL as human-readable slugs:
 *   - status   → Status.id   (already a slug, e.g. "in_progress")
 *   - priority → Priority.key (e.g. "high")
 *   - assignee → User.handle  (e.g. "mara")
 *   - label    → Label.slug   (e.g. "tech-debt")
 *
 * The UI components work in internal-id space, so these helpers translate
 * between the URL slug and the internal id using the loaded workspace data.
 */

export interface FilterLookup {
  priorities: Priority[];
  members: User[];
  labels: Label[];
}

// ── internal id → URL slug ────────────────────────────────────────────────────

export function statusIdToSlug(id: string) {
  return id; // Status.id is already the slug
}

export function priorityIdToSlug(priorities: Priority[], id: number) {
  return priorities.find((p) => p.id === id)?.key ?? String(id);
}

export function assigneeIdToSlug(members: User[], id: string) {
  return members.find((m) => m.id === id)?.handle ?? id;
}

export function labelIdToSlug(labels: Label[], id: string) {
  return labels.find((l) => l.id === id)?.slug ?? id;
}

// ── URL slug → internal id ────────────────────────────────────────────────────

export function statusSlugToId(slug: string) {
  return slug;
}

export function prioritySlugToId(priorities: Priority[], slug: string) {
  return priorities.find((p) => p.key === slug)?.id;
}

export function assigneeSlugToId(members: User[], slug: string) {
  return members.find((m) => m.handle === slug)?.id;
}

export function labelSlugToId(labels: Label[], slug: string) {
  return labels.find((l) => l.slug === slug)?.id;
}
