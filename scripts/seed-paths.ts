/**
 * Seed the `paths` table from `dataset/seed_paths.csv`.
 *
 * Idempotent: re-running upserts on `path_id` (the slug). Safe to run after
 * editing the CSV. Embeddings are NOT generated here — that's a separate
 * step (see `embed-paths.ts`, to be written next).
 *
 * Run: `npm run db:seed`
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { prisma } from "../lib/db";

// CSV path resolution:
// 1. If SEED_CSV_PATH env var is set → use that absolute path. This is the
//    default when web/ lives outside OneDrive but the dataset stays in
//    OneDrive (so we can keep curating it from Cowork).
// 2. Otherwise → fall back to <web>/../dataset/seed_paths.csv (works when
//    everything sits in the same project root).
const CSV_PATH = process.env.SEED_CSV_PATH
  ? resolve(process.env.SEED_CSV_PATH)
  : resolve(process.cwd(), "..", "dataset", "seed_paths.csv");

// Validate each CSV row before touching the DB. Bad rows are logged and
// skipped, never silently dropped.
const rawRowSchema = z.object({
  path_id: z.string().min(1),
  locale: z.enum(["it", "uk", "eu"]),
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

type RawRow = z.infer<typeof rawRowSchema>;

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

async function main() {
  console.log(`📂 Reading ${CSV_PATH}`);
  const csv = readFileSync(CSV_PATH, "utf-8");

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  console.log(`📋 Parsed ${rows.length} row(s) from CSV.\n`);

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

    const r: RawRow = result.data;

    const keyActions = splitList(r.key_actions, "|");
    const skillsGained = splitList(r.skills_gained, ",");
    const tags = splitList(r.tags, ",");

    if (keyActions.length === 0) {
      console.error(`❌ Row "${r.path_id}": key_actions is empty after split.`);
      failed++;
      continue;
    }

    try {
      await prisma.path.upsert({
        where: { pathId: r.path_id },
        create: {
          pathId: r.path_id,
          locale: r.locale,
          startingStage: r.starting_stage,
          startingField: r.starting_field,
          startingRole: r.starting_role,
          transitionType: r.transition_type,
          nextRole: r.next_role,
          timeframeMonths: r.timeframe_months,
          keyActions,
          skillsGained,
          outcome24m: r.outcome_24m,
          evidenceUrl: emptyToNull(r.evidence_url),
          confidence: r.confidence,
          tags,
          notes: emptyToNull(r.notes),
        },
        update: {
          locale: r.locale,
          startingStage: r.starting_stage,
          startingField: r.starting_field,
          startingRole: r.starting_role,
          transitionType: r.transition_type,
          nextRole: r.next_role,
          timeframeMonths: r.timeframe_months,
          keyActions,
          skillsGained,
          outcome24m: r.outcome_24m,
          evidenceUrl: emptyToNull(r.evidence_url),
          confidence: r.confidence,
          tags,
          notes: emptyToNull(r.notes),
        },
      });
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

  // Quick sanity counts.
  const total = await prisma.path.count();
  const byLocale = await prisma.path.groupBy({
    by: ["locale"],
    _count: { _all: true },
    orderBy: { locale: "asc" },
  });
  const byTransition = await prisma.path.groupBy({
    by: ["transitionType"],
    _count: { _all: true },
    orderBy: { transitionType: "asc" },
  });

  console.log(`\n📊 paths table — ${total} row(s) total`);
  console.log(`   By locale:`);
  for (const row of byLocale) {
    console.log(`     ${row.locale}: ${row._count._all}`);
  }
  console.log(`   By transition_type:`);
  for (const row of byTransition) {
    console.log(`     ${row.transitionType}: ${row._count._all}`);
  }
}

main()
  .catch((err) => {
    console.error("\n💥 Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
