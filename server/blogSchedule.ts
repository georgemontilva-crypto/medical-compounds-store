/**
 * The background half of scheduled publishing.
 *
 * Worth being clear about what this file is and isn't responsible for,
 * because the obvious reading is wrong. An article does NOT go live because
 * this loop runs. It goes live because `blogIsPublic` in server/db.ts counts
 * a scheduled post whose date has passed as published, on every public read.
 * That decision happens in the database, on the request path, with no moving
 * parts between the release date and the visitor.
 *
 * What this loop does is convert those rows to `published` afterwards, so the
 * stored status agrees with what the site is already showing. If the process
 * is restarted at the wrong minute, if a deploy eats a tick, if this timer is
 * deleted outright — Monday's article still appears on Monday. Only the
 * tidying is lost, and the next tick does it.
 *
 * That ordering is deliberate. A scheduler whose uptime decides whether
 * content ships is a scheduler that fails silently on the one morning nobody
 * is watching.
 */

import { promoteDueBlogPosts } from "./db";

/**
 * Five minutes. The window only affects how long the admin list can show
 * "scheduled" beside an article that is already public — not when the
 * article appears — so there is nothing to gain by tightening it.
 */
const PROMOTE_INTERVAL_MS = 5 * 60 * 1000;

let promoteTimer: NodeJS.Timeout | null = null;

async function runPromotion(): Promise<void> {
  try {
    const promoted = await promoteDueBlogPosts();
    if (promoted > 0) {
      console.log(`[blog] ${promoted} scheduled article(s) promoted to published`);
    }
  } catch (err) {
    // A failed tick is not an outage: the posts are live regardless, and the
    // next tick retries. Logged rather than thrown so an unreachable database
    // during a deploy doesn't take the process down with it.
    console.error("[blog] scheduled publication sweep failed:", err);
  }
}

/** Starts the sweep, and runs one immediately so a restart catches up. */
export function startBlogScheduler(): void {
  if (promoteTimer) return;

  void runPromotion();

  promoteTimer = setInterval(() => {
    void runPromotion();
  }, PROMOTE_INTERVAL_MS);
  // Housekeeping is not a reason to keep the process alive.
  promoteTimer.unref?.();
}

/** Test seam: stop the loop so a suite doesn't leave a timer behind. */
export function stopBlogSchedulerForTests(): void {
  if (promoteTimer) clearInterval(promoteTimer);
  promoteTimer = null;
}
