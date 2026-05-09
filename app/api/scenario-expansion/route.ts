import { NextRequest } from "next/server";
import { generateObject, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { ScenarioExpansionSchema } from "@/lib/ai/types";
import {
  SCENARIO_EXPANSION_PROMPT_VERSION,
  SCENARIO_EXPANSION_SYSTEM_PROMPT,
  buildScenarioExpansionUserPrompt,
} from "@/lib/ai/prompts/scenario-expansion";

/**
 * POST /api/scenario-expansion
 *
 * Body: {
 *   rec: { title, rationale, leverage, pathEvidence, twelveMonthOutcome? },
 *   profile: { stage, field, futureSelf?, dilemma?, locale }
 * }
 *
 * Returns: { scenario: ScenarioExpansion, meta: {...} }
 *
 * Used by the per-recommendation "What happens if I take this?" expand
 * on the result page. Lazy-fetched on user click — only Premium-unlocked
 * users hit this endpoint, which keeps API spend tied to interest.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5";

const BodySchema = z.object({
  rec: z.object({
    title: z.string().min(5).max(250),
    rationale: z.string().min(20).max(1500),
    leverage: z.enum(["foundation", "accelerator", "optional"]),
    pathEvidence: z.string().min(10).max(600),
    twelveMonthOutcome: z.string().min(10).max(800).optional(),
  }),
  profile: z.object({
    stage: z.string().min(1).max(60),
    field: z.string().min(1).max(60),
    futureSelf: z.string().max(1500).optional(),
    dilemma: z.string().max(1000).optional(),
    locale: z.enum(["en", "it"]).optional().default("en"),
  }),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_json", message: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  const parseResult = BodySchema.safeParse(raw);
  if (!parseResult.success) {
    return Response.json(
      {
        error: "validation_failed",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  const body = parseResult.data;

  const t0 = Date.now();

  // Up to 2 attempts — same retry logic as /api/decision-tree.
  async function tryGenerate(attempt: number) {
    return generateObject({
      model: anthropic(MODEL),
      schema: ScenarioExpansionSchema,
      system: SCENARIO_EXPANSION_SYSTEM_PROMPT,
      prompt: buildScenarioExpansionUserPrompt({
        rec: body.rec,
        profile: { ...body.profile, locale: body.profile.locale ?? "en" },
      }),
      temperature: attempt === 0 ? 0.4 : 0.55,
      maxOutputTokens: 1800,
    });
  }

  try {
    let result;
    try {
      result = await tryGenerate(0);
    } catch (firstErr) {
      if (NoObjectGeneratedError.isInstance(firstErr)) {
        console.warn(
          "[/api/scenario-expansion] first attempt failed schema, retrying...",
        );
        result = await tryGenerate(1);
      } else {
        throw firstErr;
      }
    }

    return Response.json({
      scenario: result.object,
      meta: {
        model: MODEL,
        promptVersion: SCENARIO_EXPANSION_PROMPT_VERSION,
        tokens: {
          input: result.usage?.inputTokens ?? null,
          output: result.usage?.outputTokens ?? null,
        },
        elapsedMs: Date.now() - t0,
      },
    });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("[/api/scenario-expansion] NoObjectGeneratedError");
      console.error("  raw text:", err.text?.slice(0, 1500));
      return Response.json(
        {
          error: "generation_failed",
          message: "Couldn't generate the scenario. Try again.",
          debugRaw: err.text?.slice(0, 2000) ?? null,
          debugCause:
            err.cause instanceof Error ? err.cause.message : String(err.cause),
        },
        { status: 502 },
      );
    }
    console.error("[/api/scenario-expansion] error:", err);
    return Response.json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
