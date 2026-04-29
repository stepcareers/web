import { NextRequest } from "next/server";
import { Pool } from "pg";
import { z } from "zod";

/**
 * POST /api/waitlist
 *
 * Captures a waitlist signup with the user's "what excites you most"
 * signal. Used to prioritize what we build next based on real demand.
 *
 * Body: { email, mostInterestedIn?, notes? }
 * Stores in `waitlist` table (see migration in PRODUCT_ROADMAP.md).
 */

export const runtime = "nodejs";

const InterestEnum = z.enum([
  "job_matching",
  "cv_adaptation",
  "dream_tracking",
  "accountability",
  "premium",
  "other",
]);

const SourceEnum = z.enum(["landing", "post_result"]);

const BodySchema = z.object({
  email: z.string().email().max(200),
  mostInterestedIn: InterestEnum.optional().nullable(),
  notes: z.string().max(800).optional(),
  source: SourceEnum.optional().default("landing"),
});

declare global {
  var _stepWaitlistPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global._stepWaitlistPool) {
    global._stepWaitlistPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
    });
  }
  return global._stepWaitlistPool;
}

const UPSERT_SQL = `
INSERT INTO waitlist (email, most_interested_in, notes, source)
VALUES ($1, $2, $3, $4)
ON CONFLICT (email) DO UPDATE SET
  most_interested_in = COALESCE(EXCLUDED.most_interested_in, waitlist.most_interested_in),
  notes              = COALESCE(EXCLUDED.notes, waitlist.notes),
  source             = EXCLUDED.source,
  updated_at         = NOW()
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
    await pool.query(UPSERT_SQL, [
      body.email.toLowerCase().trim(),
      body.mostInterestedIn ?? null,
      body.notes ?? null,
      body.source,
    ]);
  } catch (err) {
    console.error("[/api/waitlist] DB error:", err);
    return Response.json(
      { error: "db_failed", message: "Could not save signup. Try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
