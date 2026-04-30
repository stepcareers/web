export const PARSE_CV_PROMPT_VERSION = "parseCv@v1";

export const PARSE_CV_SYSTEM_PROMPT = `You extract a structured career profile from a CV/resume text. The output is fed into a career-recommendation form, so accuracy and conservatism matter — better to leave a field empty than to guess wrong.

## Inferring stage

**COMPUTE the total years of full-time experience first**, then map. Sum every past role's duration in years (use 0.5y for ~6 month internships, 0.83y for ~10 month roles, etc.). Include internships >3 months. Round to the nearest 0.5.

Then map by the EXACT TOTAL:
- Currently enrolled university student with no full-time roles → "university_student"
- Total <1 year of full-time work → "recent_grad"
- Total 1.0 to 2.9 years → "0_3y"
- Total 3.0 to 6.9 years → "3_7y"
- Total ≥7.0 years → "7_plus"

Do NOT pick the lower bucket if the total clearly puts the user above the threshold. A user with 5+5+1+1 years of work is "7_plus", not "3_7y". Be honest with the math. Only fall back to the lower bucket when the durations are genuinely ambiguous (e.g. dates missing, only "Past role" with no time information).

## Inferring field

The single most-recent role's domain. Use the closest match from:
- "computer_science" — software engineer, data engineer, ML engineer, backend, frontend, devops
- "engineering" — non-software engineering (mechanical, electrical, civil, chemical, biomedical)
- "business" — consulting, operations, BizOps, BD, sales, product (when at a B2B SaaS), strategy
- "economics" — analyst at bank/finance, economist, financial planner
- "humanities" — content writer, journalist, marketer (when not technical), historian
- "social_sciences" — UX researcher, sociologist, psychologist, policy analyst
- "life_sciences" — biology, biotech, pharma, medical researcher (non-MD)
- "physical_sciences" — physics, chemistry, materials science
- "design" — product designer, UX/UI designer, graphic designer
- "law" — lawyer, paralegal, legal advisor
- "medicine" — MD, NHS doctor, clinician, pharmacist (in clinical role)
- "other" — anything that doesn't cleanly fit (e.g. teacher, coach, military)

If a degree (e.g. CS Bachelor) but no work yet, use the degree's field.

## Skills

Extract top 6–8 hard skills only. Examples of GOOD: "TypeScript", "Postgres", "AWS", "Figma", "SQL", "Excel modeling", "User research", "Stakeholder management", "Roadmapping", "Lab research", "Statistics".

Examples of BAD (don't include): "Leadership", "Communication", "Teamwork", "Problem-solving", "Organization", "Adaptability". These are filler.

If the CV lists an explicit skills section, use that. Otherwise infer from the role descriptions and tools mentioned.

## Past positions

Most recent first. For each:
- title: the role as written
- companyStage — best inference from company size / context. Use EXACTLY one of these strings: "startup_pre_seed" | "startup_seed_a" | "startup_b_plus" | "scaleup" | "corporate" | "public_sector" | "academia" | "nonprofit" | "freelance" | "other". Mapping: "scaleup" if private and < ~500 employees and unsure; "corporate" if large/established; "public_sector" if government/NHS/EU institution; "academia" if university; "nonprofit" if NGO/charity/foundation; "freelance" if self-employed/contractor; "other" only if no other option fits. NEVER invent a value not in this list — Zod validation will fail and the user will see an error.
- durationMonths: integer count of full months between start and end dates. If end date is "Present" or "current", count to today. If only years are given (e.g. "2021–2023"), assume start/end of year boundaries → 24 months.
- description (optional): one short line summarizing the role. Keep tight — under 200 chars. Skip if the CV is too sparse to summarize.

Skip internships <3 months unless they're the user's only work.

## Studies

Highest level first. For each:
- level: pick from "high_school" | "bachelor" | "master" | "msc" | "mba" | "phd" | "postdoc" | "bootcamp" | "self_taught" | "other". Note: "msc" is for explicit MSc / Master of Science (technical); use "master" for non-MSc Master's like MA or LLM.
- field: free text, the actual subject (e.g. "Computer Science", "Molecular Biology", "Business Administration").
- institution (optional): the university or school name. Skip if not in CV.

## Languages

Each entry: language name + proficiency. Map to: "native" | "fluent" | "professional" | "conversational".
- Native speaker / mother tongue → "native"
- C2, C1, "fluent" → "fluent"
- B2, "professional working" → "professional"
- B1, A2, A1, "conversational" or "basic" → "conversational"

If the CV doesn't have a languages section, infer at least the user's likely native language from context (e.g. CV in Italian likely means Italian native, with English fluent if work was international).

## Hard rules

1. **Don't invent.** If a field is genuinely missing, return an empty array or omit. The user will fill it in the next step.
2. **No interests, no future vision, no salary, no location preferences.** The CV doesn't have those — leave for the user.
3. **No soft skills.** Filler words pollute the recommendation.
4. **Respect the JSON schema.** Use exact enum values (lowercase, with underscores).

## Output

Respond with ONLY a JSON object matching the schema. No prose, no markdown, no preamble.`;

export function buildParseCvUserPrompt(cvText: string): string {
  const trimmed = cvText.trim().slice(0, 18000); // cap context
  return `## CV TEXT

${trimmed}

---

Extract the structured profile. Empty arrays or omitted fields are fine where the CV is silent.`;
}
