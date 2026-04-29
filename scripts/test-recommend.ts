import "dotenv/config";
import { Pool } from "pg";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  RecommendResultSchema,
  type RecommendInput,
} from "../lib/ai/types";
import {
  buildRecommendUserPrompt,
  RECOMMEND_PROMPT_VERSION,
  RECOMMEND_SYSTEM_PROMPT,
} from "../lib/ai/prompts/recommend";

/**
 * End-to-end test of the recommend pipeline:
 *   user profile → embed → retrieve top N paths → Claude → validated JSON.
 *
 * No API route, no UI. Just the pipeline. Use this to iterate on the
 * prompt — every change here can be measured against the same fixtures.
 *
 * Run: `npm run test:recommend`
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIMENSIONS = 1024;
const MODEL_KEY = `${VOYAGE_MODEL}-${VOYAGE_DIMENSIONS}`;
const TOP_K = 5; // how many paths to retrieve per fixture

const CLAUDE_MODEL = "claude-sonnet-4-5"; // change as we iterate

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) throw new Error("Missing VOYAGE_API_KEY in .env");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY in .env");
if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL in .env");

/* ─── Fixture profiles ─────────────────────────────────────────────── */

const FIXTURES: Array<{ name: string; profile: RecommendInput }> = [
  {
    name: "Italian biology PhD considering UX research",
    profile: {
      stage: "7_plus",
      field: "life_sciences",
      skills: ["lab research", "statistics", "scientific writing", "Python"],
      interests: ["product design", "UX research", "human behavior"],
      dilemma:
        "I'm a 4th-year molecular biology PhD in Milan. I love research but academia feels like a dead end. UX research keeps coming up — but I have zero industry experience. Is the pivot real or am I deluding myself?",
      locale: "en",
    },
  },
  {
    name: "UK CS junior wanting tech lead",
    profile: {
      stage: "0_3y",
      field: "computer_science",
      skills: ["TypeScript", "Postgres", "AWS", "system design basics"],
      interests: ["scaling backend systems", "mentoring", "leadership"],
      dilemma:
        "Junior backend engineer at a Series B fintech in London, 18 months in. I want to be tech lead in 18-24 months. What do I actually do?",
      locale: "en",
    },
  },
  {
    name: "Italian Big 4 consultant → PM",
    profile: {
      stage: "0_3y",
      field: "engineering",
      skills: ["PowerPoint", "Excel modeling", "client communication", "SQL basics"],
      interests: ["product strategy", "tech", "user research"],
      dilemma:
        "Junior consultant at Big 4 in Milan. Doing tech advisory projects but it's still consulting. I want to be a PM at a SaaS company. How do I make the jump from consulting to product?",
      locale: "it",
    },
  },
  {
    name: "UK humanities recent grad in marketing",
    profile: {
      stage: "recent_grad",
      field: "humanities",
      skills: ["writing", "social media", "Excel"],
      interests: ["growth marketing", "DTC brands", "data"],
      dilemma:
        "Just graduated from a UK university in English Lit. Got a marketing intern role at an e-commerce brand. I want to be a growth lead in 3 years. What's the playbook?",
      locale: "en",
    },
  },
  {
    name: "Italian senior software engineer → Berlin",
    profile: {
      stage: "3_7y",
      field: "computer_science",
      skills: ["TypeScript", "AWS", "system design", "Postgres", "team leadership"],
      interests: ["distributed systems", "live in Germany", "higher comp"],
      dilemma:
        "5 years experience as senior backend engineer at an Italian fintech in Rome. My partner and I want to move to Berlin. How do I land a senior role at a German tech company in 6 months?",
      locale: "en",
    },
  },
];

/* ─── Helpers ──────────────────────────────────────────────────────── */

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
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb) throw new Error("No embedding returned by Voyage");
  return emb;
}

const RETRIEVE_SQL = `
SELECT
  p.path_id,
  p.locale,
  p.starting_stage,
  p.starting_field,
  p.starting_role,
  p.transition_type,
  p.next_role,
  p.timeframe_months,
  p.key_actions,
  p.skills_gained,
  p.outcome_24m,
  p.confidence,
  p.tags,
  pe.embedding <=> $1::vector AS distance
FROM path_embeddings pe
JOIN paths p ON p.id = pe.path_id
WHERE pe.model = $2
ORDER BY pe.embedding <=> $1::vector ASC
LIMIT $3
`;

/** Build one search string from the user profile. Keeps embedding-input
 * short and focused on what the user is asking for. */
function profileToQueryText(p: RecommendInput): string {
  return [
    `Stage: ${p.stage}`,
    `Field: ${p.field}`,
    `Skills: ${p.skills.join(", ")}`,
    `Interests: ${p.interests.join(", ")}`,
    p.dilemma ? `Dilemma: ${p.dilemma}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ─── Main ─────────────────────────────────────────────────────────── */

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  for (const fixture of FIXTURES) {
    console.log("\n══════════════════════════════════════════════════════");
    console.log(`📋 ${fixture.name}`);
    console.log("══════════════════════════════════════════════════════\n");

    // 1. Embed user query
    const queryText = profileToQueryText(fixture.profile);
    const t0 = Date.now();
    const queryEmbedding = await embedQuery(queryText);
    const tEmbed = Date.now() - t0;

    // 2. Retrieve top K paths
    const queryVector = `[${queryEmbedding.join(",")}]`;
    const { rows: retrievedPaths } = await pool.query(RETRIEVE_SQL, [
      queryVector,
      MODEL_KEY,
      TOP_K,
    ]);
    const tRetrieve = Date.now() - t0 - tEmbed;

    console.log(`🔍 Retrieved ${retrievedPaths.length} paths in ${tRetrieve}ms (embed: ${tEmbed}ms):`);
    for (const p of retrievedPaths) {
      const sim = (1 - parseFloat(p.distance)).toFixed(3);
      console.log(`   ${sim}  ${p.path_id}  →  ${p.next_role}`);
    }

    // 3. Build prompts
    const userPrompt = buildRecommendUserPrompt({
      profile: fixture.profile,
      retrievedPaths,
    });

    // 4. Call Claude with structured output
    console.log(`\n🤖 Calling ${CLAUDE_MODEL} with prompt ${RECOMMEND_PROMPT_VERSION}...`);
    const tLlmStart = Date.now();
    let result;
    try {
      result = await generateObject({
        model: anthropic(CLAUDE_MODEL),
        schema: RecommendResultSchema,
        system: RECOMMEND_SYSTEM_PROMPT,
        prompt: userPrompt,
      });
    } catch (err) {
      console.error(`❌ Claude/validation error:`, err);
      continue;
    }
    const tLlm = Date.now() - tLlmStart;

    const { object, usage } = result;

    console.log(`✓ Generated in ${tLlm}ms`);
    if (usage) {
      console.log(
        `   Tokens: ${usage.inputTokens ?? "?"} in / ${usage.outputTokens ?? "?"} out`,
      );
    }

    // 5. Print result
    console.log(`\n💡 RECOMMENDATIONS (${object.recommendations.length}):\n`);
    for (const [i, rec] of object.recommendations.entries()) {
      console.log(`──── ${i + 1}. ${rec.title} ────`);
      console.log(`     Confidence: ${rec.confidence.level} — ${rec.confidence.reason}`);
      console.log(`     Rationale:  ${rec.rationale}`);
      console.log(`     90-day actions:`);
      for (const a of rec.ninetyDayActions) console.log(`       • ${a}`);
      console.log(`     12-month outcome: ${rec.twelveMonthOutcome}`);
      console.log(`     Similar pattern: ${rec.similarProfilePattern}`);
      console.log(`     Based on paths: ${rec.basedOnPathIds.join(", ")}`);
      console.log();
    }

    console.log(`📣 HONEST TAKE`);
    console.log(`   ${object.honestTake}\n`);
    console.log(`❓ WHAT WE DON'T KNOW`);
    console.log(`   ${object.whatWeDontKnow}\n`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
