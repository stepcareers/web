import "dotenv/config";
import { Pool } from "pg";

/**
 * Generate Voyage embeddings for every row in `paths` and upsert them
 * into `path_embeddings`. Idempotent on (path_id, model).
 *
 * Uses raw node-postgres + Voyage REST API. No Prisma client.
 *
 * Run: `npm run db:embed`
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIMENSIONS = 1024;
const MODEL_KEY = `${VOYAGE_MODEL}-${VOYAGE_DIMENSIONS}`;

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  throw new Error("Missing VOYAGE_API_KEY env var. Add it to .env");
}

interface PathRow {
  id: string;
  path_id: string;
  locale: string;
  starting_stage: string;
  starting_field: string;
  starting_role: string;
  transition_type: string;
  next_role: string;
  timeframe_months: number;
  key_actions: string[];
  skills_gained: string[];
  tags: string[];
}

/**
 * Concatenates the path's retrievable fields into a single string we feed
 * to the embedding model. Order matters less than coverage — we want the
 * embedding to capture: where the person started, what they did, what
 * they ended up doing.
 */
function buildSearchText(p: PathRow): string {
  return [
    `Stage: ${p.starting_stage}`,
    `Field: ${p.starting_field}`,
    `Starting role: ${p.starting_role}`,
    `Transition: ${p.transition_type}`,
    `Next role: ${p.next_role}`,
    `Timeframe: ${p.timeframe_months} months`,
    `Locale: ${p.locale}`,
    `Tags: ${p.tags.join(", ")}`,
    `Skills gained: ${p.skills_gained.join(", ")}`,
    `Key actions: ${p.key_actions.join("; ")}`,
  ].join("\n");
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      output_dimension: VOYAGE_DIMENSIONS,
      input_type: "document",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Voyage API ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb) {
    throw new Error(`Unexpected Voyage response: ${JSON.stringify(data)}`);
  }
  return emb;
}

const UPSERT_EMBEDDING_SQL = `
INSERT INTO path_embeddings (path_id, model, dimensions, embedding)
VALUES ($1, $2, $3, $4::vector)
ON CONFLICT (path_id, model) DO UPDATE SET
  dimensions = EXCLUDED.dimensions,
  embedding = EXCLUDED.embedding,
  created_at = NOW()
`;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const { rows: paths } = await pool.query<PathRow>(
    `SELECT id, path_id, locale, starting_stage, starting_field, starting_role,
       transition_type, next_role, timeframe_months, key_actions, skills_gained, tags
     FROM paths
     ORDER BY path_id`,
  );

  console.log(`📂 Found ${paths.length} paths in DB.`);
  console.log(`🔮 Embedding with ${VOYAGE_MODEL} (${VOYAGE_DIMENSIONS} dims)...\n`);

  let success = 0;
  let failed = 0;

  for (const p of paths) {
    const text = buildSearchText(p);
    try {
      const start = Date.now();
      const embedding = await embed(text);
      const elapsed = Date.now() - start;

      const vectorLiteral = `[${embedding.join(",")}]`;

      await pool.query(UPSERT_EMBEDDING_SQL, [
        p.id,
        MODEL_KEY,
        VOYAGE_DIMENSIONS,
        vectorLiteral,
      ]);

      console.log(`✓ ${p.path_id} (${elapsed}ms, ${embedding.length} dims)`);
      success++;
    } catch (err) {
      console.error(`❌ ${p.path_id}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`✅ Embedded: ${success}`);
  if (failed > 0) {
    console.log(`❌ Failed:   ${failed}`);
    process.exitCode = 1;
  }

  const { rows: counts } = await pool.query(
    `SELECT model, COUNT(*)::int AS count FROM path_embeddings GROUP BY model`,
  );
  console.log(`\n📊 path_embeddings — by model:`);
  for (const row of counts) {
    console.log(`   ${row.model}: ${row.count}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
