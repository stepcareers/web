import { NextRequest } from "next/server";
import { generateObject, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { DecisionTreeResultSchema } from "@/lib/ai/types";
import {
  DECISION_TREE_PROMPT_VERSION,
  DECISION_TREE_SYSTEM_PROMPT,
  buildDecisionTreeUserPrompt,
} from "@/lib/ai/prompts/decision-tree";

/**
 * POST /api/decision-tree
 *
 * Body: {
 *   foundationRec: { title, rationale, leverage, pathEvidence, twelveMonthOutcome?, ninetyDayActions[] },
 *   profile: { stage, field, futureSelf?, dilemma?, locale },
 *   retrievedPathSlugs: string[]
 * }
 *
 * Returns: { tree: DecisionTreeResult, meta: {...} }
 *
 * Used by the result page to render a Premium-gated decision tree
 * anchored on the FOUNDATION recommendation. Auto-fetched on result
 * page load (parallel to follow-up Q&A). Free users see the first
 * stage's main line as preview; the rest is rendered behind an
 * unlock CTA that captures email + willingness-to-pay.
 *
 * Why a separate endpoint:
 *   - Stays out of /api/recommend's 60s budget.
 *   - Different lifecycle: only matters AFTER the plan is rendered.
 *   - Can be retried/refreshed independently if generation fails.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

const BodySchema = z.object({
  foundationRec: z.object({
    title: z.string().min(5).max(250),
    rationale: z.string().min(20).max(1500),
    leverage: z.enum(["foundation", "accelerator", "optional"]),
    pathEvidence: z.string().min(10).max(600),
    twelveMonthOutcome: z.string().min(10).max(800).optional(),
    ninetyDayActions: z
      .array(z.string().min(8).max(800))
      .min(2)
      .max(8),
  }),
  profile: z.object({
    stage: z.string().min(1).max(60),
    field: z.string().min(1).max(60),
    futureSelf: z.string().max(1500).optional(),
    dilemma: z.string().max(1000).optional(),
    locale: z.enum(["en", "it"]).optional().default("en"),
  }),
  retrievedPathSlugs: z.array(z.string().min(2)).max(10),
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

  // Up to 2 attempts — Haiku 4.5 occasionally produces output that
  // doesn't match the schema (e.g. branches[].trigger too short, or
  // earlyPivotSignals with 1 item). Most retries succeed because the
  // model isn't deterministic at temp 0.4. We bump temp slightly on
  // retry to break out of any sticky bad pattern.
  async function tryGenerate(attempt: number) {
    return generateObject({
      model: anthropic(MODEL),
      schema: DecisionTreeResultSchema,
      system: DECISION_TREE_SYSTEM_PROMPT,
      prompt: buildDecisionTreeUserPrompt({
        foundationRec: body.foundationRec,
        profile: {
          ...body.profile,
          locale: body.profile.locale ?? "en",
        },
        retrievedPathSlugs: body.retrievedPathSlugs,
      }),
      temperature: attempt === 0 ? 0.4 : 0.55,
      maxOutputTokens: 2500,
    });
  }

  try {
    let result;
    try {
      result = await tryGenerate(0);
    } catch (firstErr) {
      if (NoObjectGeneratedError.isInstance(firstErr)) {
        console.warn(
          "[/api/decision-tree] first attempt failed schema, retrying...",
        );
        result = await tryGenerate(1);
      } else {
        throw firstErr;
      }
    }

    return Response.json({
      tree: result.object,
      meta: {
        model: MODEL,
        promptVersion: DECISION_TREE_PROMPT_VERSION,
        tokens: {
          input: result.usage?.inputTokens ?? null,
          output: result.usage?.outputTokens ?? null,
        },
        elapsedMs: Date.now() - t0,
      },
    });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("[/api/decision-tree] NoObjectGeneratedError");
      console.error("  cause:", err.cause);
      console.error("  raw text (truncated):", err.text?.slice(0, 1500));
      return Response.json(
        {
          error: "generation_failed",
          message:
            "Couldn't generate the decision tree. Try refreshing the page.",
          // Debug payload — exposes raw model output + Zod cause so we
          // can iterate the schema/prompt without redeploying. Remove
          // once the schema stabilises.
          debugRaw: err.text?.slice(0, 2000) ?? null,
          debugCause:
            err.cause instanceof Error ? err.cause.message : String(err.cause),
        },
        { status: 502 },
      );
    }
    console.error("[/api/decision-tree] error:", err);
    return Response.json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
