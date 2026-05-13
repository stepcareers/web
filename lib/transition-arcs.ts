/**
 * Transition arc taxonomy.
 *
 * Every saved plan gets classified into exactly one of these arcs so we
 * can group users by what they're actually trying to do (vs by stage or
 * field alone, which is too coarse). This is the spine of future cohort
 * routing and any "people like you also..." features.
 *
 * Classification is rule-based today — fast, deterministic, easy to
 * audit. We'll upgrade to a small LLM classifier once we have enough
 * labelled data to detect drift between rules and reality.
 *
 * Keep this list short (~12-20). Each arc must be unambiguous and
 * cover at least 2-3% of expected traffic. Avoid micro-niches that
 * fragment cohorts.
 */
import type { RecommendInput, RecommendResult } from "./ai/types";

export const TRANSITION_ARCS = [
  "early_career_first_move",
  "engineer_to_startup",
  "engineer_to_big_tech",
  "engineer_to_ai_research",
  "consultant_to_industry",
  "banker_to_industry",
  "corporate_to_founder",
  "phd_to_industry",
  "industry_to_climate",
  "industry_to_health",
  "industry_to_finance",
  "geographic_relocation",
  "late_career_pivot",
  "return_after_break",
  "founder_to_corporate",
  "individual_to_management",
  "other",
] as const;

export type TransitionArc = (typeof TRANSITION_ARCS)[number];

/**
 * Rule-based classifier. Inspects:
 *   - profile (stage, field, current role context)
 *   - foundation recommendation (its title + leverage)
 *
 * Returns "other" when no rule fires confidently. That's intentional:
 * better an "other" bucket we can later split than a wrong arc.
 */
export function classifyTransitionArc(
  profile: RecommendInput,
  result: RecommendResult,
): TransitionArc {
  const foundation =
    result.recommendations.find((r) => r.leverage === "foundation") ??
    result.recommendations[0];
  const title = (foundation?.title ?? "").toLowerCase();
  const stage = profile.stage;
  const field = profile.field;
  const futureSelf = (profile.futureSelf ?? "").toLowerCase();
  const dilemma = (profile.dilemma ?? "").toLowerCase();
  const haystack = `${title} ${futureSelf} ${dilemma}`;

  // Order matters: more specific rules first, broader fallbacks last.
  const hits = (terms: string[]) => terms.some((t) => haystack.includes(t));

  // Career-break re-entry — strong signal regardless of field.
  if (
    hits(["career break", "after a break", "back to work", "returning to work", "re-entry", "parental leave"])
  ) {
    return "return_after_break";
  }

  // Late-career (7y+) pivots when futureSelf mentions a clear domain shift.
  if (
    stage === "7_plus" &&
    hits(["pivot", "switch industries", "new chapter", "second act", "fractional", "portfolio career"])
  ) {
    return "late_career_pivot";
  }

  // Founder paths.
  if (hits(["start a company", "found a startup", "build a startup", "found a company", "co-founder", "cofounder"])) {
    return stage === "7_plus" ? "corporate_to_founder" : "corporate_to_founder";
  }

  // Ex-founder going corporate (less common but exists).
  if (hits(["leave my startup", "exit my company", "shut down my startup", "join a company"]) && stage !== "university_student") {
    return "founder_to_corporate";
  }

  // PhD-to-industry.
  if (
    hits(["phd", "doctorate", "academia to industry", "leave academia", "research to industry"])
  ) {
    return "phd_to_industry";
  }

  // Engineering arcs — split by destination.
  if (field === "computer_science" || field === "engineering") {
    if (hits(["ai research", "machine learning research", "ml research", "research scientist", "rlhf"])) {
      return "engineer_to_ai_research";
    }
    if (hits(["faang", "google", "meta", "amazon", "apple", "microsoft", "big tech", "staff engineer", "principal engineer"])) {
      return "engineer_to_big_tech";
    }
    if (hits(["startup", "early-stage", "series a", "yc", "y combinator", "join a startup"])) {
      return "engineer_to_startup";
    }
  }

  // Consulting / banking outflows.
  if (hits(["mckinsey", "bcg", "bain", "deloitte", "consulting", "consultant"])) {
    if (hits(["leave consulting", "exit consulting", "move to industry", "operating role"])) {
      return "consultant_to_industry";
    }
  }
  if (hits(["investment banking", "goldman", "jp morgan", "morgan stanley", "ibd", "analyst program"])) {
    if (hits(["leave banking", "exit banking", "pivot to", "buy-side", "private equity"])) {
      return "banker_to_industry";
    }
  }

  // Domain pivots.
  if (hits(["climate", "renewables", "decarbon", "green tech", "sustainability", "esg"])) {
    return "industry_to_climate";
  }
  if (hits(["healthcare", "biotech", "medtech", "pharma", "hospital", "clinical"])) {
    return "industry_to_health";
  }
  if (hits(["finance role", "fintech", "venture capital", "private equity", "hedge fund", "trading"])) {
    return "industry_to_finance";
  }

  // Pure geo move (foundation talks about relocation).
  if (
    hits(["relocate", "move to london", "move to berlin", "move to new york", "move to singapore", "move abroad", "expat"])
  ) {
    return "geographic_relocation";
  }

  // First job / earliest career — only if no other arc fired.
  if (stage === "university_student" || stage === "recent_grad") {
    return "early_career_first_move";
  }

  // IC → manager track.
  if (
    hits(["first management role", "become a manager", "lead a team", "engineering manager", "team lead"])
  ) {
    return "individual_to_management";
  }

  return "other";
}

/** Human-readable label for the UI. Keep short — used in cohort names. */
export const ARC_LABELS: Record<TransitionArc, string> = {
  early_career_first_move: "First career move",
  engineer_to_startup: "Engineer → startup",
  engineer_to_big_tech: "Engineer → big tech",
  engineer_to_ai_research: "Engineer → AI research",
  consultant_to_industry: "Consultant → industry",
  banker_to_industry: "Banker → industry",
  corporate_to_founder: "Corporate → founder",
  phd_to_industry: "PhD → industry",
  industry_to_climate: "Pivot to climate",
  industry_to_health: "Pivot to health",
  industry_to_finance: "Pivot to finance",
  geographic_relocation: "Geographic relocation",
  late_career_pivot: "Late-career pivot",
  return_after_break: "Returning after a break",
  founder_to_corporate: "Founder → corporate",
  individual_to_management: "IC → manager",
  other: "Other transition",
};
