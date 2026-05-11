import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { Pool } from "pg";

/**
 * Seed the `paths` table from every `seed_paths*.csv` file in `dataset/`.
 *
 * Uses raw node-postgres (no Prisma client) so the script works on any
 * architecture, including Windows ARM where the Prisma query engine
 * binary isn't available.
 *
 * Idempotent: re-running upserts on `path_id`. Run: `npm run db:seed`.
 *
 * To load only ONE specific file, set `SEED_CSV_PATH` to its absolute path.
 */

const DATASET_DIR = resolve(process.cwd(), "..", "dataset");

function discoverCsvPaths(): string[] {
  // Single-file override (kept for backwards compat / debugging).
  if (process.env.SEED_CSV_PATH) {
    return [resolve(process.env.SEED_CSV_PATH)];
  }
  // Glob all seed CSVs. Sort for deterministic ordering — load order
  // doesn't matter functionally (all upserts on path_id), but stable
  // logs make debugging easier.
  return readdirSync(DATASET_DIR)
    .filter((f) => f.startsWith("seed_paths") && f.endsWith(".csv"))
    .sort()
    .map((f) => resolve(DATASET_DIR, f));
}

const rawRowSchema = z.object({
  path_id: z.string().min(1),
  // Open enum: accept any 2-letter lowercase ISO 3166-1 alpha-2 code, plus
  // our regional aggregates "uk" and "eu". Validating exact membership got
  // tedious as the dataset expanded across LatAm, Africa, CIS, and APAC;
  // the DB column is plain TEXT, so we trust the writer and just enforce
  // shape.
  locale: z
    .string()
    .regex(/^[a-z]{2}$/, "locale must be a 2-letter lowercase code"),
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

/**
 * Normalize enum-ish columns to the canonical values the schema expects.
 *
 * Different writers (humans + LLM agents) coined parallel vocabularies
 * over time — "mid_career", "pivot_industry", "return_to_work", etc. —
 * that semantically map to the canonical enum but would otherwise be
 * rejected by Zod. We rewrite them here so the data lands cleanly without
 * losing rows.
 */
const STAGE_NORMALIZATION: Record<string, string> = {
  mid_career: "3_7y",
  "mid-career": "3_7y",
  midcareer: "3_7y",
  early_career: "0_3y",
  "early-career": "0_3y",
  earlycareer: "0_3y",
  career_break: "3_7y",
  "career-break": "3_7y",
  returner: "3_7y",
  senior_career: "7_plus",
  "senior-career": "7_plus",
  late_career: "7_plus",
  "late-career": "7_plus",
  experienced: "7_plus",
  senior: "7_plus",
  student: "university_student",
  undergrad: "university_student",
  undergraduate: "university_student",
  "0-3y": "0_3y",
  "3-7y": "3_7y",
  "1_3y": "0_3y",
  "1-3y": "0_3y",
  "4_7y": "3_7y",
  "4-7y": "3_7y",
  "8_15y": "7_plus",
  "8-15y": "7_plus",
  "8_plus": "7_plus",
  "10_plus": "7_plus",
  "15_plus": "7_plus",
  "4_6y": "3_7y",
  "4-6y": "3_7y",
  "5_7y": "3_7y",
  "5-7y": "3_7y",
  "6_10y": "7_plus",
  "6-10y": "7_plus",
  "7_10y": "7_plus",
  "7-10y": "7_plus",
  "7+": "7_plus",
  "7_plus_y": "7_plus",
  // PhD/postdoc variants — finishing a PhD ≈ recent_grad for retrieval
  // purposes; the field already encodes "PhD" in starting_role + tags.
  phd_late_stage: "recent_grad",
  "phd-late-stage": "recent_grad",
  phd_track: "recent_grad",
  "phd-track": "recent_grad",
  phd_candidate: "recent_grad",
  "phd-candidate": "recent_grad",
  phd_student: "recent_grad",
  "phd-student": "recent_grad",
  phd: "recent_grad",
  postdoc: "0_3y",
  "post-doc": "0_3y",
  post_doc: "0_3y",
  postdoctoral: "0_3y",
  doctoral: "recent_grad",
  // Other one-offs the agents introduced
  grad_school: "university_student",
  "grad-school": "university_student",
  grad: "recent_grad",
  graduate: "recent_grad",
  new_grad: "recent_grad",
  "new-grad": "recent_grad",
  fresh_grad: "recent_grad",
  "fresh-grad": "recent_grad",
  recent_graduate: "recent_grad",
  "recent-graduate": "recent_grad",
  // Typos and creative variants seen in the wild
  early_country: "0_3y", // typo for early_career
  established: "7_plus",
  established_career: "7_plus",
  career_change: "3_7y", // agents sometimes put transition concept in stage column
  "career-change": "3_7y",
  career_changer: "3_7y",
  pivoter: "3_7y",
  late_stage: "7_plus",
  veteran: "7_plus",
  tenured: "7_plus",
  emerging: "0_3y",
  growing: "0_3y",
  intern: "university_student",
  internship: "university_student",
  entry_level: "0_3y",
  "entry-level": "0_3y",
  junior: "0_3y",
  mid_level: "3_7y",
  "mid-level": "3_7y",
  senior_level: "7_plus",
  "senior-level": "7_plus",
  senior_ic: "7_plus",
  "senior-ic": "7_plus",
  staff: "7_plus",
  principal: "7_plus",
  director: "7_plus",
  vp: "7_plus",
  manager: "3_7y",
  lead: "3_7y",
  associate: "0_3y",
};
const TRANSITION_NORMALIZATION: Record<string, string> = {
  pivot_industry: "industry_pivot",
  "pivot-industry": "industry_pivot",
  "industry-pivot": "industry_pivot",
  industrypivot: "industry_pivot",
  field_switch: "industry_pivot",
  "field-switch": "industry_pivot",
  exit_to_industry: "industry_pivot",
  "exit-to-industry": "industry_pivot",
  exit: "industry_pivot",
  industry_exit: "industry_pivot",
  vertical_promotion: "vertical_promo",
  "vertical-promotion": "vertical_promo",
  same_field_promotion: "vertical_promo",
  "same-field-promotion": "vertical_promo",
  internal_promotion: "vertical_promo",
  "internal-promotion": "vertical_promo",
  lateral_promotion: "vertical_promo",
  "lateral-promotion": "vertical_promo",
  promo_track: "vertical_promo",
  "promo-track": "vertical_promo",
  pivot_career: "industry_pivot",
  "pivot-career": "industry_pivot",
  exit_to_startup: "founder",
  "exit-to-startup": "founder",
  exit_to_founder: "founder",
  "exit-to-founder": "founder",
  accelerator_to_funding: "founder",
  "accelerator-to-funding": "founder",
  yc_to_seed: "founder",
  startup_founding: "founder",
  lateral_company: "lateral_role",
  "lateral-company": "lateral_role",
  company_switch: "lateral_role",
  "company-switch": "lateral_role",
  pivot: "industry_pivot",
  horizontal_pivot: "lateral_role",
  "horizontal-pivot": "lateral_role",
  horizontal: "lateral_role",
  role_change: "lateral_role",
  "role-change": "lateral_role",
  job_change: "lateral_role",
  "job-change": "lateral_role",
  career_change: "industry_pivot",
  "career-change": "industry_pivot",
  career_pivot: "industry_pivot",
  "career-pivot": "industry_pivot",
  continued_education: "education",
  "continued-education": "education",
  further_education: "education",
  "further-education": "education",
  postgrad: "education",
  geographic_relocation: "geo_move",
  "geographic-relocation": "geo_move",
  relocate: "geo_move",
  cross_border: "geo_move",
  "cross-border": "geo_move",
  international_move: "geo_move",
  "international-move": "geo_move",
  geo_change: "geo_move",
  "geo-change": "geo_move",
  geo_relocation: "geo_move",
  "geo-relocation": "geo_move",
  left_field: "industry_pivot",
  "left-field": "industry_pivot",
  field_left: "industry_pivot",
  geographic_change: "geo_move",
  "geographic-change": "geo_move",
  lateral_move: "lateral_role",
  "lateral-move": "lateral_role",
  cross_functional: "lateral_role",
  "cross-functional": "lateral_role",
  function_change: "lateral_role",
  "function-change": "lateral_role",
  pivot_role: "lateral_role",
  "pivot-role": "lateral_role",
  role_pivot: "lateral_role",
  "role-pivot": "lateral_role",
  return_to_work: "lateral_role",
  "return-to-work": "lateral_role",
  returnship: "lateral_role",
  return: "lateral_role",
  promotion: "vertical_promo",
  promo: "vertical_promo",
  "vertical-promo": "vertical_promo",
  vertical: "vertical_promo",
  "lateral-role": "lateral_role",
  lateral: "lateral_role",
  "founder-track": "founder",
  founding: "founder",
  entrepreneurship: "founder",
  startup: "founder",
  geographic_move: "geo_move",
  "geographic-move": "geo_move",
  "geo-move": "geo_move",
  relocation: "geo_move",
  immigration: "geo_move",
  schooling: "education",
  degree: "education",
  mba: "education",
  phd: "education",
};

function normalizeEnum(
  raw: string | undefined,
  map: Record<string, string>,
): string | undefined {
  if (!raw) return raw;
  const key = raw.toLowerCase().trim();
  return map[key] ?? raw;
}

/**
 * A few agents wrote regional aggregates ("asia", "global", "me") in the
 * locale column instead of a country code. We don't lose those rows —
 * the path_id slug usually has a real country prefix that we extract,
 * and otherwise we pick a sensible default for the region.
 */
const LOCALE_AGGREGATE_MAP: Record<string, string> = {
  asia: "sg",
  apac: "sg",
  sea: "sg",
  global: "us",
  worldwide: "us",
  international: "us",
  me: "ae",
  mena: "ae",
  middleeast: "ae",
  "middle-east": "ae",
  gcc: "ae",
  emea: "uk",
  latam: "mx",
  africa: "za",
  ssa: "za",
  europe: "eu",
  cis: "kz",
  oceania: "au",
};

function normalizeLocale(raw: string | undefined, slug?: string): string | undefined {
  if (!raw) return raw;
  const v = raw.toLowerCase().trim();
  if (LOCALE_AGGREGATE_MAP[v]) return LOCALE_AGGREGATE_MAP[v];
  // If the slug starts with a recognized 2-letter prefix, prefer that.
  if (slug && /^[a-z]{2}-/.test(slug)) return slug.slice(0, 2);
  return raw;
}

const CONFIDENCE_NORMALIZATION: Record<string, string> = {
  med: "medium",
  hi: "high",
  lo: "low",
  h: "high",
  m: "medium",
  l: "low",
  // capitalized variants get lowercased by normalizeEnum already
};

function normalizeRow(raw: Record<string, string>): Record<string, string> {
  // Under `noUncheckedIndexedAccess`, `raw.X` widens to `string | undefined`;
  // we coerce with `?? ""` so the result type satisfies `Record<string, string>`.
  // Empty strings then fail Zod validation downstream, which is the desired
  // behaviour for genuinely missing fields.
  return {
    ...raw,
    locale: normalizeLocale(raw.locale, raw.path_id) ?? raw.locale ?? "",
    starting_stage:
      normalizeEnum(raw.starting_stage, STAGE_NORMALIZATION) ??
      raw.starting_stage ??
      "",
    transition_type:
      normalizeEnum(raw.transition_type, TRANSITION_NORMALIZATION) ??
      raw.transition_type ??
      "",
    confidence:
      normalizeEnum(raw.confidence, CONFIDENCE_NORMALIZATION) ??
      raw.confidence ??
      "",
  };
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
  const csvPaths = discoverCsvPaths();
  console.log(`📂 Discovered ${csvPaths.length} CSV file(s):`);
  for (const p of csvPaths) console.log(`   - ${p}`);

  // Concatenate all rows across files. Track source file per row so we
  // can flag which file a bad row came from. Errors in one file (e.g.
  // unquoted URL with commas) shouldn't take down the whole run — we log
  // the problem with file + line and keep going.
  const allRows: Array<{ raw: Record<string, string>; source: string }> = [];
  const fileErrors: Array<{ file: string; error: string }> = [];
  for (const p of csvPaths) {
    const fileName = p.split(/[\\/]/).pop() ?? p;
    try {
      const csv = readFileSync(p, "utf-8");
      const rows = parse(csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
      for (const r of rows) allRows.push({ raw: r, source: p });
      console.log(`   ✓ ${fileName}: ${rows.length} row(s)`);
    } catch (err) {
      const e = err as { code?: string; lines?: number; message?: string };
      const lineHint = e.lines ? ` (first bad line ~${e.lines})` : "";
      const msg = `${e.code ?? "ParseError"}${lineHint}: ${e.message ?? String(err)}`;
      console.error(`   ❌ ${fileName}: ${msg}`);
      fileErrors.push({ file: fileName, error: msg });
    }
  }
  console.log(`\n📋 Total rows successfully parsed across files: ${allRows.length}`);
  if (fileErrors.length > 0) {
    console.warn(
      `\n⚠️  ${fileErrors.length} file(s) had parse errors and were skipped:`,
    );
    for (const fe of fileErrors) console.warn(`   - ${fe.file}: ${fe.error}`);
    console.warn(
      "   Likely cause: a field with commas (e.g. URL like Glassdoor) is not double-quoted.\n",
    );
  } else {
    console.log("");
  }

  // Cross-file slug collision detection. The DB upsert would silently
  // overwrite duplicates; we want to surface them so we can dedup the
  // CSVs intentionally.
  const slugCounts = new Map<string, string[]>();
  for (const { raw, source } of allRows) {
    const slug = raw.path_id;
    if (!slug) continue;
    const list = slugCounts.get(slug) ?? [];
    list.push(source);
    slugCounts.set(slug, list);
  }
  const dupes = Array.from(slugCounts.entries()).filter(
    ([, sources]) => sources.length > 1,
  );
  if (dupes.length > 0) {
    console.warn(`⚠️  ${dupes.length} duplicate path_id(s) across files:`);
    for (const [slug, sources] of dupes.slice(0, 20)) {
      console.warn(
        `   ${slug} appears in: ${sources.map((s) => s.split(/[\\/]/).pop()).join(", ")}`,
      );
    }
    if (dupes.length > 20) console.warn(`   …and ${dupes.length - 20} more`);
    console.warn(
      "   Last write wins per path_id. Resolve by deleting the duplicate row in one of the files.\n",
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let upserted = 0;
  let failed = 0;

  for (const { raw: rawOriginal } of allRows) {
    // Rewrite enum synonyms ("mid_career" → "3_7y", "pivot_industry" →
    // "industry_pivot", etc.) before Zod sees the row.
    const raw = normalizeRow(rawOriginal);
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