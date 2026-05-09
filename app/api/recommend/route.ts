import { NextRequest } from "next/server";
import { Pool } from "pg";
import { streamObject, NoObjectGeneratedError } from "ai";
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
 * Body: RecommendInput JSON.
 * Streams NDJSON: each line is one of
 *   { "type": "retrieved", "paths": [{path_id, next_role, transition_type}, ...] }
 *   { "type": "partial",   "data": <Partial<RecommendResult>> }
 *   { "type": "final",     "result": <RecommendResult>, "meta": {...} }
 *   { "type": "error",     "message": <string>, "rawSnippet"?: <string> }
 *
 * The frontend reads line-by-line and renders progressively. Crucial UX
 * win: at second 1 the user already sees which curated paths we matched,
 * at ~5–10s the first recommendation card starts filling in, by ~30s
 * the whole thing is done. Replaces the previous one-shot generateObject
 * which made users stare at a 60s spinner.
 */

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby cap

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIMENSIONS = 1024;
const MODEL_KEY = `${VOYAGE_MODEL}-${VOYAGE_DIMENSIONS}`;
const TOP_K = 5;
// Haiku 4.5 — picked for speed and reliability under Vercel Hobby's 60s
// function cap. Sonnet 4.6 was tried but consistently took 50–65s with
// the current prompt length (14 hard rules + entry-level salary bands +
// CV pre-fill bloating the input), making timeouts the dominant fail
// mode. Haiku runs in 15–25s comfortably.
//
// Known Haiku quirk: occasionally emits `recommendations` as a
// JSON-encoded STRING instead of a nested array. Handled by
// tryRepairOutput() in the catch block — parses the string, re-validates
// against Zod, and continues silently. End user never sees the bug.
const CLAUDE_MODEL = "claude-haiku-4-5";

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
  p.tags,
  pe.embedding <=> $1::vector AS distance
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
  studies?: Array<{ level: string; field: string }>;
  pastPositions?: Array<{ title: string; companyStage: string }>;
  futureSelf?: string;
  dilemma?: string;
}): string {
  const studiesText = p.studies?.length
    ? p.studies.map((s) => `${s.level} in ${s.field}`).join(", ")
    : "";
  const positionsText = p.pastPositions?.length
    ? p.pastPositions
        .map((pos) => `${pos.title} at ${pos.companyStage}`)
        .join("; ")
    : "";

  return [
    `Stage: ${p.stage}`,
    `Field: ${p.field}`,
    `Skills: ${p.skills.join(", ")}`,
    `Interests: ${p.interests.join(", ")}`,
    studiesText && `Education: ${studiesText}`,
    positionsText && `Past positions: ${positionsText}`,
    p.futureSelf ? `Future self: ${p.futureSelf}` : "",
    p.dilemma ? `Dilemma: ${p.dilemma}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Best-effort repair for known malformed LLM outputs.
 *
 * Haiku 4.5 occasionally emits `recommendations` as a JSON-encoded STRING
 * containing not just the array but ALSO the whatWeDontKnow field crammed
 * after the array's closing `]`. This produces:
 *
 *   "recommendations": "[{...},{...},{...}],\n\"whatWeDontKnow\":\"...\"\n}"
 *
 * which is JSON-invalid. The repair below handles both the simple case
 * (clean stringified array) and the harder case (everything jammed into
 * one string) by walking brackets to find the array boundary and pulling
 * whatWeDontKnow out via regex.
 */
function tryRepairOutput(rawText: string | undefined) {
  if (!rawText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;

  // First try: standard repair (recommendations is a clean stringified array)
  if (typeof obj.recommendations === "string") {
    const recsStr = obj.recommendations;
    let arr: unknown = null;
    try {
      arr = JSON.parse(recsStr);
    } catch {
      // Fall through to aggressive extraction
    }

    if (Array.isArray(arr)) {
      obj.recommendations = arr;
    } else {
      // Aggressive: walk brackets to find the [...] boundary
      const extracted = extractFirstJsonArray(recsStr);
      if (!extracted) return null;
      obj.recommendations = extracted;

      // Also try to recover whatWeDontKnow if embedded in the same string
      if (
        typeof obj.whatWeDontKnow !== "string" ||
        !obj.whatWeDontKnow
      ) {
        const recovered = extractWhatWeDontKnow(recsStr);
        if (recovered) obj.whatWeDontKnow = recovered;
      }
    }
  }

  const result = RecommendResultSchema.safeParse(obj);
  return result.success ? result.data : null;
}

/**
 * Walk brackets in a string to extract the first balanced JSON array.
 * Handles nested arrays/objects and quoted strings with escapes.
 * Returns the parsed array or null if no valid array is found.
 */
function extractFirstJsonArray(s: string): unknown[] | null {
  const start = s.indexOf("[");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        const slice = s.slice(start, i + 1);
        try {
          const parsed = JSON.parse(slice);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Pull the value of a "whatWeDontKnow" key out of a string that contains
 * malformed JSON. Returns the unescaped string or null.
 */
function extractWhatWeDontKnow(s: string): string | null {
  const match = s.match(/"whatWeDontKnow"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

/* ─── Route handler ─────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  // 1. Parse + validate body (non-streaming — fast, fail fast)
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

  // 2. Embed (non-streaming — fast, deterministic)
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

  // 3. Retrieve (also fast, ~50ms with pgvector)
  const queryVector = `[${queryEmbedding.join(",")}]`;
  const pool = getPool();
  let retrievedPaths: Array<{
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
    outcome_24m: string;
    confidence: string;
    tags: string[];
    distance: number | string;
  }>;
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

  // 4. Stream LLM output as NDJSON
  const userPrompt = buildRecommendUserPrompt({
    profile,
    retrievedPaths,
  });

  const tLlmStart = Date.now();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      // First event: retrieved paths. Lets the client show "found 5
      // similar profiles" within the first second of the stream.
      // Includes similarity (1 - cosine distance) so the methodology
      // card on the result view can show how close each match was.
      send({
        type: "retrieved",
        paths: retrievedPaths.map((p) => ({
          path_id: p.path_id,
          starting_role: p.starting_role,
          next_role: p.next_role,
          transition_type: p.transition_type,
          timeframe_months: p.timeframe_months,
          locale: p.locale,
          similarity: Math.max(0, 1 - parseFloat(String(p.distance ?? 1))),
        })),
      });

      try {
        const llmStream = streamObject({
          model: anthropic(CLAUDE_MODEL),
          schema: RecommendResultSchema,
          system: RECOMMEND_SYSTEM_PROMPT,
          prompt: userPrompt,
          maxOutputTokens: 8000,
          // Low temp: more deterministic output, less creative
          // serialization (Haiku at 0.5 occasionally encoded the whole
          // result as a string-inside-a-string).
          temperature: 0.3,
        });

        for await (const partial of llmStream.partialObjectStream) {
          send({ type: "partial", data: partial });
        }

        const finalObject = await llmStream.object;
        const usage = await llmStream.usage;

        send({
          type: "final",
          result: finalObject,
          meta: {
            model: CLAUDE_MODEL,
            promptVersion: RECOMMEND_PROMPT_VERSION,
            retrievalCount: retrievedPaths.length,
            retrievedPathIds: retrievedPaths.map((p) => p.path_id),
            tokens: {
              input: usage?.inputTokens ?? null,
              output: usage?.outputTokens ?? null,
            },
            timings: {
              embedMs: tEmbed,
              retrieveMs: tRetrieve,
              llmMs: Date.now() - tLlmStart,
              totalMs: Date.now() - t0,
            },
          },
        });
      } catch (err) {
        if (NoObjectGeneratedError.isInstance(err)) {
          console.error("[/api/recommend] NoObjectGeneratedError");
          console.error("  cause:", err.cause);
          console.error("  finishReason:", err.finishReason);
          console.error("  raw text (truncated):", err.text?.slice(0, 2000));

          // Repair attempt: some models (notably Haiku 4.5) occasionally
          // emit `recommendations` as a JSON-encoded string instead of
          // a nested array. Try to parse + re-validate before giving up.
          const repaired = tryRepairOutput(err.text);
          if (repaired) {
            console.warn("[/api/recommend] repaired malformed output");
            send({
              type: "final",
              result: repaired,
              meta: {
                model: CLAUDE_MODEL,
                promptVersion: RECOMMEND_PROMPT_VERSION,
                retrievalCount: retrievedPaths.length,
                retrievedPathIds: retrievedPaths.map((p) => p.path_id),
                tokens: { input: null, output: null },
                timings: {
                  embedMs: tEmbed,
                  retrieveMs: tRetrieve,
                  llmMs: Date.now() - tLlmStart,
                  totalMs: Date.now() - t0,
                },
              },
            });
            return;
          }

          const causeMsg =
            err.cause instanceof Error ? err.cause.message : String(err.cause);
          send({
            type: "error",
            message: `Model output didn't match schema. ${causeMsg}`,
            rawSnippet: err.text?.slice(0, 500),
          });
        } else {
          console.error("[/api/recommend] LLM stream error:", err);
          send({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
