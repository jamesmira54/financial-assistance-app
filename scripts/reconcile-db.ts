/**
 * DB RECONCILE — bring an *outdated* database up to the committed Prisma schema
 * WITHOUT resetting or wiping data, and heal a divergent `_prisma_migrations` ledger.
 *
 * WHY THIS EXISTS
 *   Migration history diverged: some databases (e.g. a teammate's local DB shared
 *   as a dump) recorded their own squashed migrations (`initial_setup`, `new`) that
 *   are NOT in `prisma/migrations/`, and recorded NONE of the repo's migrations.
 *   With no common ancestor, the usual commands are unsafe on such a DB:
 *     - `prisma migrate dev`     -> detects drift, wants to RESET (wipes data)
 *     - `prisma migrate deploy`  -> replays every repo migration from scratch onto
 *                                   tables that already exist -> fails (error 1050)
 *   This script fixes an outdated DB the data-preserving way instead:
 *     1. PATCH: apply only the physical delta (missing columns/enums/tables) computed
 *        live from the DB -> committed schema. Additive changes keep existing rows.
 *     2. BASELINE: mark every repo migration as "applied" in `_prisma_migrations`
 *        (without re-running its SQL) so the ledger matches git going forward.
 *     3. CLEAN: drop stray ledger rows that don't correspond to any repo migration,
 *        so `prisma migrate status` reads fully in-sync.
 *
 * The single source of truth is `prisma/migrations/` in git. After running this once,
 * `prisma migrate deploy` works normally for all future migrations — nobody resets.
 *
 * RUN (dry-run — prints the plan, changes NOTHING; do this first):
 *     npx ts-node scripts/reconcile-db.ts
 *
 * RUN (actually apply — take a DB backup first, e.g. mysqldump):
 *     npx ts-node scripts/reconcile-db.ts --apply
 *
 * Idempotent: safe to re-run. On an already in-sync DB it does nothing.
 *
 * NOTE: uses the datasource in prisma/schema.prisma (i.e. DATABASE_URL from .env) for
 * every DB connection — the connection string is never placed on the command line.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const APPLY = process.argv.includes("--apply");

const ROOT = path.join(__dirname, "..");
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");

const prisma = new PrismaClient();

/** Run a shell command, returning stdout. Throws (with stderr) on non-zero exit. */
function sh(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Prisma CLI helper — all sub-commands inherit DATABASE_URL from .env. */
function prismaCli(args: string): string {
  return sh(`npx prisma ${args}`);
}

type LedgerRow = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null };

async function readLedger(): Promise<LedgerRow[]> {
  try {
    return await prisma.$queryRawUnsafe<LedgerRow[]>(
      "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at",
    );
  } catch {
    // Table absent => a DB Prisma has never migrated. Baseline will create it.
    return [];
  }
}

function readLocalMigrations(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** Live DB -> committed datamodel delta, as raw SQL (empty when already in sync). */
function computeDelta(): string {
  return prismaCli(
    `migrate diff --from-schema-datasource "${SCHEMA}" --to-schema-datamodel "${SCHEMA}" --script`,
  );
}

/** Keep only executable SQL lines (drop comments/blanks) to test for emptiness. */
function isEmptySql(sql: string): boolean {
  return (
    sql
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("--"))
      .join("")
      .trim().length === 0
  );
}

function hr(title: string) {
  console.log(`\n${"─".repeat(70)}\n${title}\n${"─".repeat(70)}`);
}

async function main() {
  console.log(`DB RECONCILE  (${APPLY ? "APPLY — will modify the database" : "DRY-RUN — no changes"})`);

  const local = readLocalMigrations();
  const ledger = await readLedger();
  const appliedNames = new Set(ledger.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name));
  const failed = ledger.filter((r) => !r.finished_at || r.rolled_back_at).map((r) => r.migration_name);

  const pending = local.filter((m) => !appliedNames.has(m)); // in repo, not recorded applied
  const phantom = ledger.map((r) => r.migration_name).filter((n) => !local.includes(n)); // recorded, not in repo

  const delta = computeDelta();
  const noDelta = isEmptySql(delta);
  const destructive = /DROP\s+(TABLE|COLUMN|FOREIGN KEY)/i.test(delta);

  // ---- Report the plan ----------------------------------------------------
  hr("SCHEMA DELTA (live DB → committed schema)");
  console.log(noDelta ? "✔ Physical schema already matches the committed schema — nothing to patch." : delta.trim());
  if (destructive) {
    console.log("\n⚠  Delta contains DROP statements — review the lines above. These drop columns/tables");
    console.log("   that the committed schema no longer defines. Rows in dropped columns are lost.");
  }

  hr("MIGRATION LEDGER");
  console.log(`Repo migrations (source of truth) : ${local.length}`);
  console.log(`Already recorded as applied       : ${appliedNames.size}`);
  console.log(`To baseline (mark applied, no re-run): ${pending.length}`);
  pending.forEach((m) => console.log(`   + ${m}`));
  console.log(`Stray ledger rows to remove       : ${phantom.length}`);
  phantom.forEach((m) => console.log(`   - ${m}   (not in prisma/migrations)`));
  if (failed.length) {
    console.log(`\n⚠  Failed/rolled-back migration records present: ${failed.join(", ")}`);
    console.log("   Resolve these first: npx prisma migrate resolve --rolled-back <name>");
  }

  if (noDelta && pending.length === 0 && phantom.length === 0) {
    hr("RESULT");
    console.log("✔ Database is already in sync with the repo. No action needed.");
    return;
  }

  if (!APPLY) {
    hr("DRY-RUN — no changes made");
    console.log("Review the plan above. When ready (and after a backup):");
    console.log("   npx ts-node scripts/reconcile-db.ts --apply");
    return;
  }

  if (failed.length) {
    throw new Error("Refusing to apply while failed migration records exist — resolve them first (see above).");
  }

  // ---- Apply --------------------------------------------------------------
  hr("APPLYING");

  if (!noDelta) {
    const file = path.join(os.tmpdir(), `reconcile-delta-${Date.now()}.sql`);
    fs.writeFileSync(file, delta);
    console.log(`1/3  Applying schema delta (${file}) …`);
    prismaCli(`db execute --schema "${SCHEMA}" --file "${file}"`);
    fs.unlinkSync(file);
    console.log("     ✔ delta applied");
  } else {
    console.log("1/3  No schema delta to apply — skipped.");
  }

  if (pending.length) {
    console.log(`2/3  Baselining ${pending.length} migration(s) as applied …`);
    for (const name of pending) {
      prismaCli(`migrate resolve --applied "${name}"`);
      console.log(`     ✔ ${name}`);
    }
  } else {
    console.log("2/3  No migrations to baseline — skipped.");
  }

  if (phantom.length) {
    console.log(`3/3  Removing ${phantom.length} stray ledger row(s) …`);
    for (const name of phantom) {
      await prisma.$executeRawUnsafe("DELETE FROM _prisma_migrations WHERE migration_name = ?", name);
      console.log(`     ✔ removed ${name}`);
    }
  } else {
    console.log("3/3  No stray ledger rows — skipped.");
  }

  // ---- Verify -------------------------------------------------------------
  hr("VERIFY");
  const status = prismaCli("migrate status");
  console.log(status.trim());
  if (/up to date|No pending migrations/i.test(status) && !/have not yet been applied|are different/i.test(status)) {
    console.log("\n✔ Reconcile complete — DB is in sync with the repo. Future `prisma migrate deploy` will just work.");
  } else {
    console.log("\n⚠ `migrate status` is not fully clean — inspect the output above.");
  }
}

main()
  .catch((e) => {
    console.error("\n✖ RECONCILE FAILED:", e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
