import { NextRequest } from "next/server";
import { Pool } from "pg";
import { z } from "zod";

/**
 * POST /api/feedback
 *
 * Captures thumbs-up / thumbs-down on individual recommendations, plus an
 * optional reason. Used to spot retrieval/quality patterns: which path_ids
 * consistently lead to bad recommendations, which stages/fields have the
 * weakest output.
 *
 * Body: { rating, recommendationIndex, recommendationTitle, basedOnPathIds[], reason? }
 * Stores in `recommendation_feedback`.
 */

export const runtime = "nodejs";

const BodySchema = z.object({
  rating: z.enum(["up", "down"]),
  recommendationIndex: z.coerce.number().int().min(0).max(10),
  recommendationTitle: z.string().min(1).max(200),
  basedOnPathIds: z.array(z.string().min(1).max(80)).min(1).max(10),
  reason: z.string().max(800).optional(),
});

declare global {
  var _stepFeedbackPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global._stepFeedbackPool) {
    global._stepFeedbackPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
    });
  }
  return global._stepFeedbackPool;
}

const INSERT_SQL = `
INSERT INTO recommendation_feedback (
  rating, recommendation_index, recommendation_title,
  based_on_path_ids, reason
) VALUES ($1, $2, $3, $4, $5)
`;

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

  try {
    const pool = getPool();
    await pool.query(INSERT_SQL, [
      body.rating,
      body.recommendationIndex,
      body.recommendationTitle,
      body.basedOnPathIds,
      body.reason ?? null,
    ]);
  } catch (err) {
    console.error("[/api/feedback] DB error:", err);
    return Response.json(
      { error: "db_failed", message: "Could not save feedback. Try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
