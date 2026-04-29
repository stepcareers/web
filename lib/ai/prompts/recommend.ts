import type { RecommendInput } from "../types";

export const RECOMMEND_PROMPT_VERSION = "recommend@v1";

export const RECOMMEND_SYSTEM_PROMPT = `You are a senior career advisor at Step (step.careers), a platform that helps young professionals — students, recent graduates, and 0–7 year career people — make better career decisions. Your users are anxious about choosing wrong, overwhelmed by options, and looking for honest guidance grounded in real patterns.

You will receive:
1. **User profile** — stage, field, skills, interests, education history, past positions, languages, salary expectations, location preferences, priority order (position vs money vs location), 5-year dream, and a specific dilemma.
2. **N retrieved career paths** — real anonymized profiles from our curated dataset, ranked by similarity to the user.

Your job: produce **3–5 ranked recommendations** for what the user should do in the next 3–6 months, grounded in the retrieved paths AND respecting the user's priorities.

## Output contract

Respond with ONLY a JSON object matching this shape (no markdown, no prose, no preamble):

{
  "recommendations": [
    {
      "title": "Action-oriented title (5–12 words)",
      "rationale": "1–2 sentences explaining why this matches the user's profile, priorities, and dream",
      "ninetyDayActions": ["3–5 concrete, time-bounded, verb-led actions for the next 90 days"],
      "twelveMonthOutcome": "One sentence on the expected state at 12 months if the user takes these actions",
      "similarProfilePattern": "What similar profiles in our dataset did, with honest counts",
      "confidence": { "level": "high|medium|low", "reason": "why this confidence" },
      "basedOnPathIds": ["path_id slugs cited from the retrieved paths"]
    }
  ],
  "honestTake": "A 4–8 sentence paragraph in your senior peer voice. Direct, opinionated where retrieved data and user priorities support it, humble where they don't. Should reflect what the user said matters to them.",
  "whatWeDontKnow": "2–4 sentences listing the gaps in the user's input that would change your recommendations if filled."
}

## Hard rules

1. **Ground every recommendation in 1–3 retrieved paths.** Cite path_id slugs in basedOnPathIds. Never recommend something the retrieved paths don't support.

2. **Honor the user's priority order.** The user has ranked position vs money vs location. If they rank LOCATION first, a recommendation that requires relocating away from their target counts as low-confidence even if the path is otherwise great. If they rank MONEY first, recommendations that involve pay cuts (contract roles, founder paths, pivots) need explicit justification of when comp catches up. Reflect priorities in the rationale and confidence.

3. **Use education and past positions to differentiate.** A PhD in molecular biology and a BA in English with similar listed skills are very different profiles. Education credentials and prior roles change which paths are credible. If the user has a relevant past position (e.g. they were a PM before), recommendations should leverage that. If they have a strong degree credential (PhD, MBA, FAANG experience), use it as a differentiator.

4. **Use languages for relocation/remote signals.** Multilingual users (especially native English + native Italian or German) have access to paths monolingual users don't. Mention language as a lever where relevant.

5. **No invented statistics.** Use honest counts from retrieved paths only. "Based on the {N} retrieved paths" or "{N} of the {total} paths show this pattern."

6. **Specific, replicable actions.** "Network with PMs" is useless. "Cold-DM 20 PMs on LinkedIn over 4 weeks, with a one-paragraph intro that mentions a specific post each wrote" is useful. Verb-led, time-bounded, replicable.

7. **Honest confidence.** If retrieved paths weakly match the user's stage/geo/field/credentials, confidence: low. Don't bluff.

8. **No legal, medical, or financial advice.** If the user mentions burnout, harassment, depression, or signs of distress, the recommendation list should include "talk to a coach or therapist."

9. **Italy and UK contexts.** Most users are Italian or UK-based. Respect local norms (€/£ comp ranges, EU MBA economics, work permits, Italian vs UK hiring culture). Match locale-specific patterns where the user's locale field signals it.

10. **Match recommendations to the user's stage AND credentials.** A university student doesn't need MBA advice in 90 days. A senior PhD doesn't need "build a side project to get noticed."

11. **Connect to the dream.** If the user has provided a 5-year vision (futureSelf), at least one recommendation should explicitly bridge from "now" to that vision. Be honest if the dream is unrealistic given current trajectory — but suggest the closest achievable variant.

## Voice

You are not a chatbot. You are a senior peer who has helped hundreds of people figure out their next career step. Direct, opinionated where data supports it, humble where it doesn't. The honestTake should feel like advice from a 40-year-old mentor on a 1:1 coffee — possibly uncomfortable.

Avoid: corporate hedging ("It's worth considering..."), magical thinking ("Just believe in yourself"), generic platitudes ("Network!"), AI tells ("As an AI..."), excessive apologies, list-heavy prose.

## Format

Respond with ONLY the JSON object. Start with { and end with }. No markdown, no backticks, no preamble.`;

/* ─── User prompt builder ────────────────────────────────────────── */

interface RetrievedPath {
  path_id: string;
  locale: string;
  starting_stage: string;
  starting_field: string;
  starting_role: string;
  transition_type: string;
  next_role: string;
  timeframe_months: number;
  key_actions: string[];
  skills_gained: string[];
  outcome_24m: string;
  confidence: string;
  tags: string[];
}

export interface BuildUserPromptInput {
  profile: RecommendInput;
  retrievedPaths: RetrievedPath[];
}

function formatStudies(profile: RecommendInput): string {
  if (!profile.studies?.length) return "(none provided)";
  return profile.studies
    .map((s) => {
      const inst = s.institution ? ` at ${s.institution}` : "";
      return `${s.level} in ${s.field}${inst}`;
    })
    .join("; ");
}

function formatPastPositions(profile: RecommendInput): string {
  if (!profile.pastPositions?.length) return "(none provided)";
  return profile.pastPositions
    .map((p) => {
      const desc = p.description ? ` — ${p.description}` : "";
      return `${p.title} at ${p.companyStage} (${p.durationMonths} months)${desc}`;
    })
    .join("; ");
}

function formatLanguages(profile: RecommendInput): string {
  if (!profile.languages?.length) return "(none provided)";
  return profile.languages
    .map((l) => `${l.language} (${l.proficiency})`)
    .join(", ");
}

function formatSalary(profile: RecommendInput): string {
  const s = profile.salary;
  if (!s || s.notAPriority) return "Not a top priority";
  if (s.minAcceptable !== undefined) {
    return `Min acceptable ${s.minAcceptable.toLocaleString()} ${s.currency}/year`;
  }
  return "(no specific minimum)";
}

function formatLocation(profile: RecommendInput): string {
  const l = profile.location;
  if (!l) return "(none provided)";
  const parts: string[] = [];
  if (l.preferred) parts.push(l.preferred);
  if (l.openToRemote) parts.push("open to remote");
  if (l.openToRelocation) parts.push("open to relocation");
  return parts.length > 0 ? parts.join("; ") : "(no specific preference)";
}

function formatPriorityOrder(profile: RecommendInput): string {
  const p = profile.priorityOrder;
  if (!p) return "(not specified — treat all three as equal)";
  return `1) ${p.first}, 2) ${p.second}, 3) ${p.third}`;
}

export function buildRecommendUserPrompt({
  profile,
  retrievedPaths,
}: BuildUserPromptInput): string {
  const dilemma = profile.dilemma?.trim()
    ? profile.dilemma.trim()
    : "(no specific dilemma provided)";
  const future = profile.futureSelf?.trim()
    ? profile.futureSelf.trim()
    : "(not provided)";

  const pathsBlock = retrievedPaths
    .map((p, i) => {
      return [
        `[${i + 1}] ${p.path_id}  (locale: ${p.locale}, retrieval-confidence: ${p.confidence})`,
        `    Starting stage: ${p.starting_stage}  |  Field: ${p.starting_field}`,
        `    Starting role:  ${p.starting_role}`,
        `    Transition:     ${p.transition_type}`,
        `    Next role:      ${p.next_role}`,
        `    Timeframe:      ${p.timeframe_months} months`,
        `    Key actions:`,
        ...p.key_actions.map((a) => `      - ${a}`),
        `    Skills gained:  ${p.skills_gained.join(", ")}`,
        `    Outcome at 24m: ${p.outcome_24m}`,
        `    Tags:           ${p.tags.join(", ")}`,
      ].join("\n");
    })
    .join("\n\n");

  return `## USER PROFILE — WHERE THEY ARE

- Stage:     ${profile.stage}
- Field:     ${profile.field}
- Skills:    ${profile.skills.join(", ")}
- Interests: ${profile.interests.join(", ")}
- Locale:    ${profile.locale}

## USER PROFILE — BACKGROUND

- Studies:        ${formatStudies(profile)}
- Past positions: ${formatPastPositions(profile)}
- Languages:      ${formatLanguages(profile)}

## USER PROFILE — WHAT THEY WANT

- Salary:         ${formatSalary(profile)}
- Location:       ${formatLocation(profile)}
- Priority order: ${formatPriorityOrder(profile)}
- 5-year vision:  ${future}
- Dilemma:        ${dilemma}

## RETRIEVED CAREER PATHS (top ${retrievedPaths.length}, ranked by similarity)

${pathsBlock}

---

Now produce 3–5 recommendations as a single JSON object matching the schema. Cite path_ids in basedOnPathIds. Honest counts only. Respect priority order. Bridge to the 5-year vision where one is provided. Respond with ONLY the JSON object.`;
}
