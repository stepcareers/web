import { NextRequest } from "next/server";
import { generateObject, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { CvParseResultSchema } from "@/lib/ai/types";
import {
  buildParseCvUserPrompt,
  PARSE_CV_PROMPT_VERSION,
  PARSE_CV_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/parse-cv";

/**
 * POST /api/parse-cv
 *
 * Body: { text: string }  (paste CV text — PDF parsing TODO)
 * Returns: { parsed: CvParseResult, meta: {...} }
 *
 * Uses Haiku for cost (this is structured extraction, doesn't need Sonnet
 * quality). Output validated by Zod against CvParseResultSchema. Privacy:
 * the CV text is processed in memory only and not persisted.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const PARSE_MODEL = "claude-haiku-4-5";

const BodySchema = z.object({
  text: z.string().min(50, "CV text seems too short").max(20000),
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

  const parseInput = BodySchema.safeParse(raw);
  if (!parseInput.success) {
    return Response.json(
      {
        error: "validation_failed",
        details: parseInput.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const t0 = Date.now();

  try {
    const result = await generateObject({
      model: anthropic(PARSE_MODEL),
      schema: CvParseResultSchema,
      system: PARSE_CV_SYSTEM_PROMPT,
      prompt: buildParseCvUserPrompt(parseInput.data.text),
      temperature: 0.2, // low temp — extraction, not creativity
      maxOutputTokens: 3000,
    });

    return Response.json({
      parsed: result.object,
      meta: {
        model: PARSE_MODEL,
        promptVersion: PARSE_CV_PROMPT_VERSION,
        tokens: {
          input: result.usage?.inputTokens ?? null,
          output: result.usage?.outputTokens ?? null,
        },
        elapsedMs: Date.now() - t0,
      },
    });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("[/api/parse-cv] NoObjectGeneratedError");
      console.error("  cause:", err.cause);
      console.error("  raw text (truncated):", err.text?.slice(0, 1000));
      return Response.json(
        {
          error: "parse_failed",
          message:
            "Couldn't extract a clean profile from this CV. Try the manual form instead.",
        },
        { status: 502 },
      );
    }
    console.error("[/api/parse-cv] error:", err);
    return Response.json(
      {
        error: "parse_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
