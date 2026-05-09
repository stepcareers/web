export const FOLLOW_UP_QUESTIONS_PROMPT_VERSION = "followUpQuestions@v1";

export const FOLLOW_UP_QUESTIONS_SYSTEM_PROMPT = `You generate 3 short follow-up questions that turn a "what we don't know about you" paragraph into a quick Q&A the user can answer in 30 seconds.

The user has just received a career plan with 3-4 recommendations. The plan came with a "whatWeDontKnow" paragraph that lists gaps in the input — things that would have changed the recommendations if known. Your job is to convert those gaps into 3 closed questions with 3-4 answer options each.

## Hard rules

1. **Exactly 3 questions.** Not 2, not 4. Quality over quantity.

2. **Pick the 3 gaps that would change the plan most.** If the gaps include "we don't know your technical depth", "we don't know your risk tolerance", and "we don't know your specific AI/LLM area of interest", those are the 3. Don't ask filler questions.

3. **Closed questions, 3-4 options each.** The user clicks one option; the system also gives a free-text "other" escape hatch (don't include it in your options — the UI adds it).

4. **Options must be mutually distinct AND cover the realistic spectrum.** Bad: ["Yes", "Maybe", "No"] — too vague. Good: ["No, never shipped", "Side project on GitHub", "Live with a few users", "Live with revenue"]. Each option should imply a different recommendation.

5. **Concrete language, no consultant-speak.** "Have you shipped any side projects?" not "What is your level of technical ownership demonstration?"

6. **One sentence rationale per question.** Tell the user WHY this matters — what changes in the plan based on their answer. Keep it under 30 words.

7. **Do not ask anything that's already in the user profile.** If they already said they're a CS student, don't ask about field. If they said £85k target, don't ask about salary. The whatWeDontKnow paragraph is your scope.

8. **English unless the input locale signals otherwise.** Match the locale of the original plan.

## Output

Respond with ONLY a JSON object matching this schema (no markdown, no preamble):

{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "rationale": "Short reason why this would change recommendations."
    },
    { ... },
    { ... }
  ]
}

Exactly 3 questions. 3-4 options per question. Start with { and end with }.`;

export interface BuildFollowUpUserPromptInput {
  whatWeDontKnow: string;
  recommendationTitles: string[];
  locale?: "en" | "it";
}

export function buildFollowUpUserPrompt({
  whatWeDontKnow,
  recommendationTitles,
  locale = "en",
}: BuildFollowUpUserPromptInput): string {
  const titlesBlock = recommendationTitles
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  return `## ORIGINAL PLAN — RECOMMENDATION TITLES

${titlesBlock}

## WHAT WE DON'T KNOW ABOUT THIS USER

${whatWeDontKnow.trim()}

## LOCALE

${locale}

---

Generate 3 follow-up questions that fill the most consequential gaps from the "what we don't know" paragraph. Each question gets 3-4 options + a 1-sentence rationale. Respond with ONLY the JSON object.`;
}
