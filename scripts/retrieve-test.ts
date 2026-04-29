import "dotenv/config";
import { Pool } from "pg";

/**
 * Smoke test for the retrieval pipeline. Embeds a handful of natural-language
 * queries, runs cosine-distance search against `path_embeddings`, and prints
 * the top 5 most similar paths.
 *
 * Use this to sanity-check that:
 *   1. Voyage embeddings are produced
 *   2. pgvector cosine-distance ordering returns paths that *feel* right
 *
 * Run: `npm run db:retrieve-test`
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIMENSIONS = 1024;
const MODEL_KEY = `${VOYAGE_MODEL}-${VOYAGE_DIMENSIONS}`;

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  throw new Error("Missing VOYAGE_API_KEY env var. Add it to .env");
}

const TEST_QUERIES = [
  "I'm a biology PhD considering switching to UX research",
  "Junior software engineer at a startup, want to become tech lead",
  "Big 4 consultant in Italy thinking of becoming a product manager",
  "Mid-career engineer wanting to do an MBA and switch to consulting",
  "Recent humanities graduate getting into marketing",
  "Senior software engineer in Italy looking to move to Berlin",
];

async function embedQuery(text: string): Promise<number[]> {
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
      input_type: "query",
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb) {
    throw new Error(`Unexpected Voyage response: ${JSON.stringify(data)}`);
  }
  return emb;
}

const SEARCH_SQL = `
SELECT
  p.path_id,
  p.starting_role,
  p.next_role,
  p.transition_type,
  p.locale,
  pe.embedding <=> $1::vector AS distance
FROM path_embeddings pe
JOIN paths p ON p.id = pe.path_id
WHERE pe.model = $2
ORDER BY pe.embedding <=> $1::vector ASC
LIMIT 5
`;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Sanity: count embeddings.
  const { rows: countRows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM path_embeddings WHERE model = $1`,
    [MODEL_KEY],
  );
  const totalEmbeddings = countRows[0]?.count ?? 0;
  console.log(`📊 ${totalEmbeddings} embeddings in DB for model ${MODEL_KEY}\n`);
  if (totalEmbeddings === 0) {
    console.error("No embeddings to search against. Run `npm run db:embed` first.");
    process.exit(1);
  }

  for (const query of TEST_QUERIES) {
    console.log(`\n─────────────────────────────────────────`);
    console.log(`🔍 ${query}`);
    console.log(`─────────────────────────────────────────`);

    const start = Date.now();
    const queryEmbedding = await embedQuery(query);
    const queryVector = `[${queryEmbedding.join(",")}]`;

    const { rows } = await pool.query(SEARCH_SQL, [queryVector, MODEL_KEY]);
    const elapsed = Date.now() - start;

    for (const [i, row] of rows.entries()) {
      const similarity = (1 - parseFloat(row.distance)).toFixed(3);
      console.log(
        `  ${i + 1}. ${row.path_id}  [${row.locale}, ${row.transition_type}]  sim=${similarity}`,
      );
      console.log(`     ${row.starting_role}`);
      console.log(`     → ${row.next_role}`);
    }
    console.log(`  (${elapsed}ms total round-trip)`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
