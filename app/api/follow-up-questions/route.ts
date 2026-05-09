import { NextRequest } from "next/server";
import { generateObject, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { FollowUpQuestionsResultSchema } from "@/lib/ai/types";
import {
  FOLLOW_UP_QUESTIONS_PROMPT_VERSION,
  FOLLOW_UP_QUESTIONS_SYSTEM_PROMPT,
  buildFollowUpUserPrompt,
} from "@/lib/ai/prompts/follow-up-questions";

/**
 * POST /api/follow-up-questions
 *
 * Body: {
 *   whatWeDontKnow: string,           // from the just-generated plan
 *   recommendationTitles: string[],   // titles only, for context
 *   locale?: "en" | "it"
 * }
 *
 * Returns: { questions: FollowUpQuestion[3], meta: {...} }
 *
 * Used by the result page to power a 30-second Q&A above the free-text
 * refine box. Each question is closed-form (3-4 options) with a free-text
 * "other" escape hatch on the client side. The user's answers are
 * concatenated into additionalContext and sent back through /api/recommend
 * to regenerate the plan.
 *
 * Why a separate endpoint instead of returning questions in the same
 * stream as /api/recommend:
 *   - Keeps /api/recommend's 60s budget for the actual plan.
 *   - Q&A only matters AFTER the user has read the plan; pre-generating
 *     it would waste tokens for users who never use the refine flow.
 *   - Caching: client-side, the questions don't change unless
 *     whatWeDontKnow changes — we can let users re-open the result page
 *     without regenerating.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

const BodySchema = z.object({
  whatWeDontKnow: z.string().min(20).max(2000),
  recommendationTitles: z.array(z.string().min(3).max(200)).min(1).max(8),
  locale: z.enum(["en", "it"]).optional().default("en"),
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
  try {
    const result = await generateObject({
      model: anthropic(MODEL),
      schema: FollowUpQuestionsResultSchema,
      system: FOLLOW_UP_QUESTIONS_SYSTEM_PROMPT,
      prompt: buildFollowUpUserPrompt(body),
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    return Response.json({
      questions: result.object.questions,
      meta: {
        model: MODEL,
        promptVersion: FOLLOW_UP_QUESTIONS_PROMPT_VERSION,
        tokens: {
          input: result.usage?.inputTokens ?? null,
          output: result.usage?.outputTokens ?? null,
        },
        elapsedMs: Date.now() - t0,
      },
    });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("[/api/follow-up-questions] NoObjectGeneratedError");
      console.error("  cause:", err.cause);
      console.error("  raw text (truncated):", err.text?.slice(0, 600));
      return Response.json(
        {
          error: "generation_failed",
          message:
            "Couldn't generate follow-up questions. Use the free-text refine box below.",
        },
        { status: 502 },
      );
    }
    console.error("[/api/follow-up-questions] error:", err);
    return Response.json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
