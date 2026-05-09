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
  "nonprofit",
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

export const SalarySchema = z
  .object({
    notAPriority: z.boolean().default(false),
    current: z.coerce.number().int().min(0).max(2_000_000).optional(),
    minAcceptable: z.coerce.number().int().min(0).max(2_000_000).optional(),
    currency: CurrencyEnum.default("EUR"),
  })
  .refine(
    // Anchor for realism: the form must communicate ONE of:
    //   - current salary (a number, 0 means "no income yet" via the
    //     student/between-roles checkbox in the UI)
    //   - notAPriority = true (user explicitly opts out)
    // Without one of these the recommender invents salary bands, which
    // is the fastest way to make the output read as fake.
    (s) => s.notAPriority === true || typeof s.current === "number",
    "Provide current comp (or 0 for no-income), or mark salary as not a priority.",
  );

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

  // Step 3 — what you're after
  // The fields below were optional in v1; promoted to required because
  // empty values produced generic, anchorless recommendations. Length
  // minimums enforce a *useful* answer rather than "boh".
  // location stays optional — many users genuinely don't have a preference,
  // and forcing them to type "anywhere" adds noise.
  salary: SalarySchema,
  priorityOrder: PriorityOrderSchema,
  futureSelf: z.string().min(40, "At least 40 characters — be specific.").max(800),
  dilemma: z.string().min(30, "At least 30 characters — name the actual choice.").max(500),
  location: LocationPrefSchema.optional(),

  // Refinement context — typed by the user after seeing the first plan,
  // in response to "what we don't know about you". Fills gaps the model
  // flagged. Treated as authoritative additional info.
  additionalContext: z.string().max(1500).optional(),

  // System
  locale: z.enum(["en", "it"]).default("en"),
});

/* ─── CV parser output (best-effort extraction from text) ────────── */

export const CvParseResultSchema = z.object({
  stage: StageEnum.optional().describe(
    "Best guess from years of experience. <1y or student → recent_grad / university_student. 0–3y, 3–7y, 7+.",
  ),
  field: FieldEnum.optional().describe(
    "Domain of the most recent role or studies. Use 'other' if genuinely unclear.",
  ),
  skills: z
    .array(z.string().min(1).max(80))
    .max(8)
    .default([])
    .describe(
      "Top 6–8 hard skills (technical, domain-specific, tools). NO soft skills like 'leadership' or 'communication'.",
    ),
  studies: z
    .array(StudySchema)
    .max(5)
    .default([])
    .describe("Highest first."),
  pastPositions: z
    .array(PastPositionSchema)
    .max(8)
    .default([])
    .describe("Most recent first. durationMonths from start/end dates."),
  languages: z.array(LanguageSchema).max(8).default([]),
});

export type CvParseResult = z.infer<typeof CvParseResultSchema>;

/* ─── Follow-up questions (post-result Q&A refinement) ──────────── */
//
// After the user sees the first plan, the model has produced a
// "whatWeDontKnow" paragraph listing gaps. We turn that paragraph into
// 3 closed-form questions with 3-4 options each, so the user can sharpen
// the plan in 30 seconds instead of writing a paragraph in the refine
// box. Free-text "other" is always allowed for cases the options miss.
export const FollowUpQuestionSchema = z.object({
  question: z
    .string()
    .min(10)
    .max(200)
    .describe(
      "A specific, closed question that fills one gap from whatWeDontKnow. e.g. 'Have you shipped any side projects publicly?'",
    ),
  options: z
    .array(z.string().min(1).max(120))
    .min(3)
    .max(4)
    .describe(
      "3-4 short answer options the user can pick. Concrete, mutually distinct, cover the realistic spectrum. e.g. ['No, never', 'One small thing', 'Yes, with users', 'Yes, with revenue'].",
    ),
  rationale: z
    .string()
    .min(15)
    .max(280)
    .describe(
      "1 short sentence on WHY this answer would change the plan. Shown as a hint under the question. e.g. 'If you've shipped, recommendations skew toward leveraging that — if not, toward shipping first.'",
    ),
});

export const FollowUpQuestionsResultSchema = z.object({
  questions: z
    .array(FollowUpQuestionSchema)
    .length(3)
    .describe("Exactly 3 questions — quality over quantity."),
});

export type FollowUpQuestion = z.infer<typeof FollowUpQuestionSchema>;
export type FollowUpQuestionsResult = z.infer<
  typeof FollowUpQuestionsResultSchema
>;

/* ─── Decision Tree (Premium) ─────────────────────────────────────
 *
 * Anchored on the FOUNDATION recommendation. Walks the user through
 * 3 main time stages (NOW→D90, D90→M6, M6→M18) with bifurcations
 * (if-then forks), then a YEAR-5 outlook with best/base/worst scenarios,
 * plus 2-4 early pivot signals to watch for.
 *
 * Premium-gated in the UI: free users see only the first stage's
 * `main` line as a preview, the rest is shown blurred + behind an
 * email/willingness-to-pay capture.
 * ──────────────────────────────────────────────────────────────── */

export const DecisionTreeStageSchema = z.object({
  label: z
    .string()
    .min(5)
    .max(40)
    .describe(
      "Time-window label, e.g. 'NOW → DAY 90', 'DAY 90 → MONTH 6', 'MONTH 6 → MONTH 18'.",
    ),
  main: z
    .string()
    .min(20)
    .max(450)
    .describe(
      "1-3 sentences on the primary action/state during this window. Concrete, verb-led.",
    ),
  branches: z
    .array(
      z.object({
        trigger: z
          .string()
          .min(8)
          .max(200)
          .describe(
            "The observable signal that triggers this branch. 'If your side project gets >100 WAU' / 'If onboarding is rough at week 6'.",
          ),
        outcome: z
          .string()
          .min(15)
          .max(320)
          .describe(
            "What you should do if the trigger fires. Specific, time-bounded.",
          ),
      }),
    )
    .min(0)
    .max(3)
    .default([])
    .describe("0-3 if-then forks for this window. Quality > quantity."),
});

export const DecisionTreeResultSchema = z.object({
  anchorTitle: z
    .string()
    .min(5)
    .max(160)
    .describe("The recommendation this tree is anchored on (foundation rec)."),
  anchorLeverage: LeverageEnum,
  stages: z
    .array(DecisionTreeStageSchema)
    .length(3)
    .describe(
      "Exactly 3 stages: NOW→D90, D90→M6, M6→M18. Year-5 lives in endScenarios.",
    ),
  endScenarios: z
    .object({
      best: z
        .string()
        .min(20)
        .max(400)
        .describe("Year-5 best case if everything goes right."),
      base: z
        .string()
        .min(20)
        .max(400)
        .describe("Year-5 base case (most likely outcome)."),
      worst: z
        .string()
        .min(20)
        .max(400)
        .describe(
          "Year-5 worst case. Honest, not catastrophic — the realistic downside.",
        ),
    })
    .describe("Year-5 fork: 3 scenarios for outcome distribution."),
  earlyPivotSignals: z
    .array(z.string().min(10).max(240))
    .min(2)
    .max(4)
    .describe(
      "2-4 specific early-warning signals that should make the user pivot away from this anchor before month 6.",
    ),
});

export type DecisionTreeStage = z.infer<typeof DecisionTreeStageSchema>;
export type DecisionTreeResult = z.infer<typeof DecisionTreeResultSchema>;

/* ─── Per-recommendation scenario expansion (Premium) ─────────────
 *
 * Lighter-weight than DecisionTree: a single rec, 3 horizons (3mo,
 * 12mo, 5y) + risks + tradeoff. Lazy-loaded when the user clicks a
 * specific rec's "What happens if I take this?" expand.
 * ──────────────────────────────────────────────────────────────── */

export const ScenarioExpansionSchema = z.object({
  recTitle: z.string().min(5).max(160),
  threeMonth: z
    .string()
    .min(20)
    .max(400)
    .describe("Where you'd be at month 3 if you take this rec."),
  twelveMonth: z
    .string()
    .min(20)
    .max(450)
    .describe("Where you'd be at month 12, with leading indicators."),
  fiveYear: z
    .string()
    .min(20)
    .max(450)
    .describe("The realistic year-5 state if you stick with this path."),
  risks: z
    .array(z.string().min(15).max(260))
    .min(2)
    .max(4)
    .describe("2-4 specific risks. Not generic ('change is hard') — concrete."),
  tradeoff: z
    .string()
    .min(15)
    .max(360)
    .describe(
      "What this rec CLOSES. Opportunity cost — what you give up by going this way.",
    ),
});

export type ScenarioExpansion = z.infer<typeof ScenarioExpansionSchema>;

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
