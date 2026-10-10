/**
 * Applies the blog scheduling migration and loads the October cycle.
 *
 *     node scripts/blog/load.mjs
 *
 * Exists because the seed is ~90 kB of SQL, which is more than a shell
 * `mysql -e "..."` or a console paste box will take. This reads the files off
 * disk and sends them over the same connection the app uses, so there is no
 * copying step to get wrong.
 *
 * Safe to run more than once: the migration checks what is already there, and
 * every insert in the seed is keyed on the article's slug.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import "dotenv/config";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n" +
      "It lives in the project's .env, the same one the app reads. If it is\n" +
      "missing, copy the value from the Railway MySQL service → Variables."
  );
  process.exit(1);
}

const connection = await mysql.createConnection({ uri: url, multipleStatements: true });

try {
  // ── 1. Schema ──────────────────────────────────────────────────────────────
  //
  // Checked rather than blindly applied: ALTER and CREATE INDEX both error on
  // a second run, and a script that fails the second time you run it is a
  // script nobody trusts enough to run the first time.
  const [columns] = await connection.query(
    "SHOW COLUMNS FROM blog_posts LIKE 'scheduledFor'"
  );

  if (columns.length > 0) {
    console.log("1/2  schema — already migrated, nothing to do");
  } else {
    const migration = fs.readFileSync(
      path.join(ROOT, "drizzle/0029_blog_scheduled_publishing.sql"),
      "utf-8"
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
    console.log("1/2  schema — scheduledFor added, status enum widened, index created");
  }

  // ── 2. The articles ────────────────────────────────────────────────────────
  const seed = fs.readFileSync(path.join(ROOT, "scripts/blog/seed_articles.sql"), "utf-8");
  await connection.query(seed);

  // Both the time and the is-it-live answer are computed by MySQL and come
  // back as plain strings. Letting the driver hand back a Date would reopen
  // exactly the timezone question the seed goes to such lengths to close: the
  // driver reads a naive datetime in the Node process's zone, which is not
  // necessarily the database's, and the printout would be off by the
  // difference while the stored instant was perfectly correct.
  const [rows] = await connection.query(
    "SET time_zone = '+00:00'; " +
      "SELECT slug, status," +
      "  DATE_FORMAT(publishedAt, '%Y-%m-%d %H:%i') AS utc," +
      "  DATE_FORMAT(CONVERT_TZ(publishedAt, '+00:00', '-04:00'), '%b %e, %l:%i %p') AS caracas," +
      "  (publishedAt <= NOW()) AS live" +
      " FROM blog_posts ORDER BY publishedAt"
  );
  const posts = rows[rows.length - 1];

  console.log(`2/2  articles — ${posts.length} in the blog\n`);
  for (const p of posts) {
    console.log(
      `     ${p.live ? "live now " : "         "} ` +
        `${p.utc} UTC   ${String(p.caracas ?? "").padEnd(18)} ${p.slug}`
    );
  }

  // Printed so the zone question is answered by the server rather than
  // assumed. The app reads timestamps through the driver, which lines up only
  // while these two agree; they do on Railway, where both run in UTC.
  const [[tz]] = await connection.query(
    "SELECT @@session.time_zone AS session_tz, @@global.time_zone AS global_tz"
  );
  console.log(
    `\n     database zone: ${tz.global_tz} (global)   ·   this script's node: ${
      Intl.DateTimeFormat().resolvedOptions().timeZone
    }`
  );
  console.log("\nDone. The scheduled ones appear on their own, 9:00 AM Caracas.");
} catch (err) {
  console.error("\nFailed:", err.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
