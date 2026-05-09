import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { Pool } from "pg";

/**
 * Seed the `paths` table from `dataset/seed_paths.csv`.
 *
 * Uses raw node-postgres (no Prisma client) so the script works on any
 * architecture, including Windows ARM where the Prisma query engine
 * binary isn't available.
 *
 * Idempotent: re-running upserts on `path_id`. Run: `npm run db:seed`.
 */

const CSV_PATH = process.env.SEED_CSV_PATH
  ? resolve(process.env.SEED_CSV_PATH)
  : resolve(process.cwd(), "..", "dataset", "seed_paths.csv");

const rawRowSchema = z.object({
  path_id: z.string().min(1),
  locale: z.enum(["it", "uk", "eu", "us"]),
  starting_stage: z.enum([
    "university_student",
    "recent_grad",
    "0_3y",
    "3_7y",
    "7_plus",
  ]),
  starting_field: z.string().min(1),
  starting_role: z.string().min(1),
  transition_type: z.enum([
    "lateral_role",
    "vertical_promo",
    "industry_pivot",
    "education",
    "founder",
    "geo_move",
  ]),
  next_role: z.string().min(1),
  timeframe_months: z.coerce.number().int().positive(),
  key_actions: z.string(),
  skills_gained: z.string(),
  outcome_24m: z.string(),
  evidence_url: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

function splitList(raw: string | undefined, sep: string): string[] {
  if (!raw) return [];
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

function emptyToNull(s: string | undefined): string | null {
  const trimmed = s?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

const UPSERT_SQL = `
INSERT INTO paths (
  path_id, locale, starting_stage, starting_field, starting_role,
  transition_type, next_role, timeframe_months, key_actions, skills_gained,
  outcome_24m, evidence_url, confidence, tags, notes, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
)
ON CONFLICT (path_id) DO UPDATE SET
  locale = EXCLUDED.locale,
  starting_stage = EXCLUDED.starting_stage,
  starting_field = EXCLUDED.starting_field,
  starting_role = EXCLUDED.starting_role,
  transition_type = EXCLUDED.transition_type,
  next_role = EXCLUDED.next_role,
  timeframe_months = EXCLUDED.timeframe_months,
  key_actions = EXCLUDED.key_actions,
  skills_gained = EXCLUDED.skills_gained,
  outcome_24m = EXCLUDED.outcome_24m,
  evidence_url = EXCLUDED.evidence_url,
  confidence = EXCLUDED.confidence,
  tags = EXCLUDED.tags,
  notes = EXCLUDED.notes,
  updated_at = NOW()
`;

async function main() {
  console.log(`📂 Reading ${CSV_PATH}`);
  const csv = readFileSync(CSV_PATH, "utf-8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  console.log(`📋 Parsed ${rows.length} row(s) from CSV.\n`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let upserted = 0;
  let failed = 0;

  for (const raw of rows) {
    const result = rawRowSchema.safeParse(raw);
    if (!result.success) {
      console.error(
        `❌ Invalid row "${raw.path_id ?? "<unknown>"}":`,
        JSON.stringify(result.error.flatten().fieldErrors, null, 2),
      );
      failed++;
      continue;
    }

    const r = result.data;
    const keyActions = splitList(r.key_actions, "|");
    const skillsGained = splitList(r.skills_gained, ",");
    const tags = splitList(r.tags, ",");

    if (keyActions.length === 0) {
      console.error(`❌ Row "${r.path_id}": key_actions is empty after split.`);
      failed++;
      continue;
    }

    try {
      await pool.query(UPSERT_SQL, [
        r.path_id,
        r.locale,
        r.starting_stage,
        r.starting_field,
        r.starting_role,
        r.transition_type,
        r.next_role,
        r.timeframe_months,
        keyActions,
        skillsGained,
        r.outcome_24m,
        emptyToNull(r.evidence_url),
        r.confidence,
        tags,
        emptyToNull(r.notes),
      ]);
      console.log(`✓ ${r.path_id}`);
      upserted++;
    } catch (err) {
      console.error(`❌ DB upsert failed for "${r.path_id}":`, err);
      failed++;
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`✅ Upserted: ${upserted}`);
  if (failed > 0) {
    console.log(`❌ Failed:   ${failed}`);
    process.exitCode = 1;
  }

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM paths`);
  const total = totalRes.rows[0].count as number;
  const byLocaleRes = await pool.query(
    `SELECT locale, COUNT(*)::int AS count FROM paths GROUP BY locale ORDER BY locale`,
  );
  const byTransitionRes = await pool.query(
    `SELECT transition_type, COUNT(*)::int AS count FROM paths GROUP BY transition_type ORDER BY transition_type`,
  );

  console.log(`\n📊 paths table — ${total} row(s) total`);
  console.log(`   By locale:`);
  for (const row of byLocaleRes.rows) {
    console.log(`     ${row.locale}: ${row.count}`);
  }
  console.log(`   By transition_type:`);
  for (const row of byTransitionRes.rows) {
    console.log(`     ${row.transition_type}: ${row.count}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});