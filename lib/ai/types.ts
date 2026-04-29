import { z } from "zod";

/**
 * The contract between the LLM and the rest of the app.
 *
 * Every recommendation result must validate against `RecommendResultSchema`.
 * The shape is enforced both in the prompt (we tell Claude exactly this
 * shape) and in code via `generateObject({ schema })`.
 *
 * Char limits are guardrails against runaway output, not stylistic
 * constraints — they're loose enough that good content fits comfortably.
 */

export const ConfidenceSchema = z.object({
  level: z.enum(["high", "medium", "low"]),
  reason: z
    .string()
    .min(10, "Confidence reason must be at least 10 chars")
    .max(500, "Confidence reason must be at most 500 chars"),
});

export const RecommendationSchema = z.object({
  /** Action-oriented headline. */
  title: z
    .string()
    .min(8, "Title must be at least 8 chars")
    .max(140, "Title must be at most 140 chars"),

  /** Why this move matches the user's profile. 1–3 sentences. */
  rationale: z
    .string()
    .min(30, "Rationale must be at least 30 chars")
    .max(800, "Rationale must be at most 800 chars"),

  /** 3–5 concrete, time-bounded, verb-led actions for the next 90 days. */
  ninetyDayActions: z
    .array(
      z
        .string()
        .min(15, "Each action must be at least 15 chars")
        .max(500, "Each action must be at most 500 chars"),
    )
    .min(3, "Need at least 3 actions")
    .max(5, "Max 5 actions"),

  /** One-to-two sentences on expected state at 12 months. */
  twelveMonthOutcome: z
    .string()
    .min(20, "Outcome must be at least 20 chars")
    .max(500, "Outcome must be at most 500 chars"),

  /** What similar profiles in the dataset did. Honest counts only. */
  similarProfilePattern: z
    .string()
    .min(30, "Pattern must be at least 30 chars")
    .max(700, "Pattern must be at most 700 chars"),

  /** Confidence + reason. */
  confidence: ConfidenceSchema,

  /** path_id slugs cited from the retrieved paths. */
  basedOnPathIds: z
    .array(z.string().min(3))
    .min(1, "Must cite at least 1 retrieved path")
    .max(5, "Max 5 cited paths"),
});

export const RecommendResultSchema = z.object({
  /** 3–5 ranked recommendations. */
  recommendations: z
    .array(RecommendationSchema)
    .min(3, "Need at least 3 recommendations")
    .max(5, "Max 5 recommendations"),

  /** 4–10 sentence paragraph in the senior peer voice. */
  honestTake: z
    .string()
    .min(150, "Honest take must be at least 150 chars")
    .max(1800, "Honest take must be at most 1800 chars"),

  /** 2–5 sentences listing input gaps that would change the recommendations. */
  whatWeDontKnow: z
    .string()
    .min(40, "What-we-dont-know must be at least 40 chars")
    .max(900, "What-we-dont-know must be at most 900 chars"),
});

export type Confidence = z.infer<typeof ConfidenceSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type RecommendResult = z.infer<typeof RecommendResultSchema>;

/* ─── Input schemas ──────────────────────────────────────────────────── */

export const RecommendInputSchema = z.object({
  stage: z.enum([
    "university_student",
    "recent_grad",
    "0_3y",
    "3_7y",
    "7_plus",
  ]),
  field: z.enum([
    "computer_science",
    "engineering",
    "business",
    "economics",
    "humanities",
    "social_sciences",
    "life_sciences",
    "physical_sciences",
    "design",
    "law",
    "medicine",
    "other",
  ]),
  skills: z.array(z.string().min(1)).min(1).max(8),
  interests: z.array(z.string().min(1)).min(1).max(5),
  dilemma: z.string().max(500).optional(),
  locale: z.enum(["en", "it"]).default("en"),
});

export type RecommendInput = z.infer<typeof RecommendInputSchema>;
