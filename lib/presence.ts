import "server-only";
import { db } from "@/lib/db";

// ─── "Last seen" ────────────────────────────────────────────────────────────
//
// Platform administration needs this to tell dead accounts from ones in use
// — not to watch someone work in real time. It's deliberately coarse for
// that reason: an accuracy of one hour answers "is this account still being
// used?" just as well as one of one second, but doesn't cost a write on
// every page load.
//
// Two brakes sit one after another. The first is an in-process memo:
// whoever was already counted just now doesn't even trigger a query. The
// second lives in the `WHERE` condition and still applies when several
// instances are running or the process has restarted — there, the database
// decides, not the memo.

const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Who this process last let through, and when.
 *
 * Only a shortcut, not the truth: if the memo is lost, the condition in the
 * query decides — at most one extra write happens.
 */
const seen = new Map<string, number>();

/**
 * Record a sign of life, at most once per hour and account.
 *
 * Swallows its errors: the column staying an hour stale must never cost a
 * page.
 */
export async function touchLastSeen(userId: string): Promise<void> {
  const now = Date.now();
  const last = seen.get(userId);
  if (last !== undefined && now - last < INTERVAL_MS) return;
  seen.set(userId, now);

  try {
    // `updateMany` instead of `update`: the condition is the actual point —
    // this way the database only writes when the value is genuinely stale,
    // and two instances don't step on each other. `update` doesn't support
    // a `where` beyond the key and would have to read first.
    await db.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date(now - INTERVAL_MS) } },
        ],
      },
      data: { lastSeenAt: new Date(now) },
    });
  } catch (error) {
    seen.delete(userId);
    console.error("[presence] lastSeenAt not written:", error);
  }
}
