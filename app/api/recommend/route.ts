import { NextRequest } from "next/server";
import { Pool } from "pg";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  RecommendInputSchema,
  RecommendResultSchema,
} from "@/lib/ai/types";
import {
  buildRecommendUserPrompt,
  RECOMMEND_PROMPT_VERSION,
  RECOMMEND_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/recommend";

/**
 * POST /api/recommend
 *
 * Body: RecommendInput JSON (stage, field, skills, interests, dilemma?, locale)
 * Returns: { result: RecommendResult, meta: { ... } }
 *
 * Pipeline:
 *   1. Validate body with Zod
 *   2. Embed user query via Voyage
 *   3. Retrieve top K paths via pgvector cosine
 *   4. Build prompt, call Claude with structured output
 *   5. Validate output, return JSON + meta
 *
 * Pure-pg under the hood (no Prisma client at runtime — keeps cold start
 * small and avoids the Windows-ARM binary that broke us locally).
 */

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby cap; Sonnet 4.5 can exceed — see TODO

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIMENSIONS = 1024;
const MODEL_KEY = `${VOYAGE_MODEL}-${VOYAGE_DIMENSIONS}`;
const TOP_K = 5;
const CLAUDE_MODEL = "claude-sonnet-4-5";

/* ─── Pool singleton ────────────────────────────────────────────────── */

declare global {
  var _stepPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global._stepPool) {
    global._stepPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return global._stepPool;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY not set");

  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      output_dimension: VOYAGE_DIMENSIONS,
      input_type: "query",
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  }

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
  p.tags
FROM path_embeddings pe
JOIN paths p ON p.id = pe.path_id
WHERE pe.model = $2
ORDER BY pe.embedding <=> $1::vector ASC
LIMIT $3
`;

function profileToQueryText(p: {
  stage: string;
  field: string;
  skills: string[];
  interests: string[];
  dilemma?: string;
}): string {
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

/* ─── Route handler ─────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  // 1. Parse + validate body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_json", message: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  const parseResult = RecommendInputSchema.safeParse(raw);
  if (!parseResult.success) {
    return Response.json(
      {
        error: "validation_failed",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  const profile = parseResult.data;

  const t0 = Date.now();

  // 2. Embed
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(profileToQueryText(profile));
  } catch (err) {
    console.error("[/api/recommend] embed error:", err);
    return Response.json(
      { error: "embed_failed", message: String(err) },
      { status: 502 },
    );
  }
  const tEmbed = Date.now() - t0;

  // 3. Retrieve
  const queryVector = `[${queryEmbedding.join(",")}]`;
  const pool = getPool();
  let retrievedPaths;
  try {
    const result = await pool.query(RETRIEVE_SQL, [
      queryVector,
      MODEL_KEY,
      TOP_K,
    ]);
    retrievedPaths = result.rows;
  } catch (err) {
    console.error("[/api/recommend] retrieval error:", err);
    return Response.json(
      { error: "retrieval_failed", message: String(err) },
      { status: 500 },
    );
  }
  const tRetrieve = Date.now() - t0 - tEmbed;

  if (retrievedPaths.length === 0) {
    return Response.json(
      { error: "no_paths", message: "No retrievable career paths in DB" },
      { status: 503 },
    );
  }

  // 4. LLM
  const userPrompt = buildRecommendUserPrompt({
    profile,
    retrievedPaths,
  });

  let llmResult;
  const tLlmStart = Date.now();
  try {
    llmResult = await generateObject({
      model: anthropic(CLAUDE_MODEL),
      schema: RecommendResultSchema,
      system: RECOMMEND_SYSTEM_PROMPT,
      prompt: userPrompt,
    });
  } catch (err) {
    console.error("[/api/recommend] LLM/validation error:", err);
    return Response.json(
      { error: "llm_failed", message: String(err) },
      { status: 502 },
    );
  }
  const tLlm = Date.now() - tLlmStart;

  // 5. Return
  return Response.json({
    result: llmResult.object,
    meta: {
      model: CLAUDE_MODEL,
      promptVersion: RECOMMEND_PROMPT_VERSION,
      retrievalCount: retrievedPaths.length,
      retrievedPathIds: retrievedPaths.map((p) => p.path_id),
      tokens: {
        input: llmResult.usage?.inputTokens ?? null,
        output: llmResult.usage?.outputTokens ?? null,
      },
      timings: {
        embedMs: tEmbed,
        retrieveMs: tRetrieve,
        llmMs: tLlm,
        totalMs: Date.now() - t0,
      },
    },
  });
}
