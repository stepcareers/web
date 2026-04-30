import { z } from "zod";

/**
 * The contract between the LLM and the rest of the app.
 *
 * Char limits are guardrails against runaway output, not stylistic
 * constraints — they're loose enough that good content fits comfortably.
 */

/* ─── Output schemas (LLM must produce this) ─────────────────────── */

export const ConfidenceSchema = z.object({
  level: z.enum(["high", "medium", "low"]),
  reason: z.string().min(5).max(600).describe("Why this confidence level (1-2 sentences)."),
});

export const LeverageEnum = z
  .enum(["foundation", "accelerator", "optional"])
  .describe(
    "How essential this step is to the 5-year vision. 'foundation' = without this, the vision is unrealistic. 'accelerator' = compresses the timeframe but the path can work without it. 'optional' = useful but not gating.",
  );

export const RecommendationSchema = z.object({
  title: z.string().min(5).max(160).describe("Action-oriented title (5-12 words)."),
  rationale: z.string().min(20).max(1000).describe("2-3 sentences on why this fits the user."),
  ninetyDayActions: z
    .array(z.string().min(8).max(600))
    .min(2)
    .max(6)
    .describe("3-4 concrete, time-bounded actions, each 1-2 sentences."),
  twelveMonthOutcome: z.string().min(15).max(600).describe("One sentence on the 12-month state."),
  similarProfilePattern: z
    .string()
    .min(20)
    .max(900)
    .describe("What similar profiles did, with honest counts (1-2 sentences)."),
  confidence: ConfidenceSchema,
  basedOnPathIds: z
    .array(z.string().min(2))
    .min(1)
    .max(6)
    .describe("path_id slugs cited from retrieved paths."),
  leverage: LeverageEnum,
  pathEvidence: z
    .string()
    .min(15)
    .max(400)
    .describe(
      "Concrete count from the retrieved paths. e.g. '3 of 5 retrieved profiles took this exact move; 2 reached an equivalent outcome within 24 months.' Must be grounded in actual paths — never invented percentages.",
    ),
});

export const RecommendResultSchema = z.object({
  recommendations: z
    .array(RecommendationSchema)
    .min(2)
    .max(6)
    .describe("3-4 ranked recommendations. Quality over quantity."),
  honestTake: z
    .string()
    .min(80)
    .max(2200)
    .describe(
      "ALWAYS REQUIRED. Never omit. A 4-6 sentence paragraph in senior peer voice — direct, opinionated, possibly uncomfortable. Reflects what the user said matters to them.",
    ),
  whatWeDontKnow: z
    .string()
    .min(20)
    .max(1100)
    .describe(
      "ALWAYS REQUIRED. Never omit. 2-3 sentences on the gaps in the user's input that would change recommendations if filled.",
    ),
});

export type Confidence = z.infer<typeof ConfidenceSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type RecommendResult = z.infer<typeof RecommendResultSchema>;

/* ─── Input schemas (form sends this) ────────────────────────────── */

export const StageEnum = z.enum([
  "university_student",
  "recent_grad",
  "0_3y",
  "3_7y",
  "7_plus",
]);

export const FieldEnum = z.enum([
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
]);

export const DegreeLevelEnum = z.enum([
  "high_school",
  "bachelor",
  "master",
  "msc",
  "mba",
  "phd",
  "postdoc",
  "bootcamp",
  "self_taught",
  "other",
]);

export const StudySchema = z.object({
  level: DegreeLevelEnum,
  field: z.string().min(2).max(120), // e.g. "Computer Science", "Molecular Biology"
  institution: z.string().max(140).optional(), // e.g. "Politecnico di Milano"
});

export const CompanyStageEnum = z.enum([
  "startup_pre_seed",
  "startup_seed_a",
  "startup_b_plus",
  "scaleup",
  "corporate",
  "public_sector",
  "academia",
  "freelance",
  "other",
]);

export const PastPositionSchema = z.object({
  title: z.string().min(2).max(120),
  companyStage: CompanyStageEnum,
  durationMonths: z.coerce.number().int().min(1).max(600),
  description: z.string().max(280).optional(),
});

export const LanguageProficiencyEnum = z.enum([
  "native",
  "fluent",
  "professional",
  "conversational",
]);

export const LanguageSchema = z.object({
  language: z.string().min(2).max(40),
  proficiency: LanguageProficiencyEnum,
});

export const CurrencyEnum = z.enum(["EUR", "GBP", "USD"]);

export const SalarySchema = z.object({
  notAPriority: z.boolean().default(false),
  current: z.coerce.number().int().min(0).max(2_000_000).optional(),
  minAcceptable: z.coerce.number().int().min(0).max(2_000_000).optional(),
  currency: CurrencyEnum.default("EUR"),
});

export const LocationPrefSchema = z.object({
  preferred: z.string().max(200).optional(), // e.g. "Berlin, Milan, or remote EU"
  openToRemote: z.boolean().default(false),
  openToRelocation: z.boolean().default(false),
});

export const PriorityValueEnum = z.enum(["position", "money", "location"]);

export const PriorityOrderSchema = z
  .object({
    first: PriorityValueEnum,
    second: PriorityValueEnum,
    third: PriorityValueEnum,
  })
  .refine(
    (v) => new Set([v.first, v.second, v.third]).size === 3,
    "Each priority must be different",
  );

export const RecommendInputSchema = z.object({
  // Step 1 — where you are now
  stage: StageEnum,
  field: FieldEnum,
  skills: z.array(z.string().min(1).max(80)).min(1).max(8),
  interests: z.array(z.string().min(1).max(80)).min(1).max(5),

  // Step 2 — your background (NEW)
  studies: z.array(StudySchema).min(1).max(5),
  pastPositions: z.array(PastPositionSchema).max(8).default([]),
  languages: z.array(LanguageSchema).min(1).max(8),

  // Step 3 — what you're after (NEW)
  salary: SalarySchema.optional(),
  location: LocationPrefSchema.optional(),
  priorityOrder: PriorityOrderSchema.optional(),
  futureSelf: z.string().max(800).optional(),
  dilemma: z.string().max(500).optional(),

  // Refinement context — typed by the user after seeing the first plan,
  // in response to "what we don't know about you". Fills gaps the model
  // flagged. Treated as authoritative additional info.
  additionalContext: z.string().max(1500).optional(),

  // System
  locale: z.enum(["en", "it"]).default("en"),
});

export type Stage = z.infer<typeof StageEnum>;
export type Field = z.infer<typeof FieldEnum>;
export type DegreeLevel = z.infer<typeof DegreeLevelEnum>;
export type Study = z.infer<typeof StudySchema>;
export type CompanyStage = z.infer<typeof CompanyStageEnum>;
export type PastPosition = z.infer<typeof PastPositionSchema>;
export type LanguageProficiency = z.infer<typeof LanguageProficiencyEnum>;
export type LanguageRow = z.infer<typeof LanguageSchema>;
export type Currency = z.infer<typeof CurrencyEnum>;
export type Salary = z.infer<typeof SalarySchema>;
export type LocationPref = z.infer<typeof LocationPrefSchema>;
export type PriorityValue = z.infer<typeof PriorityValueEnum>;
export type PriorityOrder = z.infer<typeof PriorityOrderSchema>;
export type RecommendInput = z.infer<typeof RecommendInputSchema>;
