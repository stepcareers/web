"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import posthog from "posthog-js";

// Thin wrapper so capture call sites stay short and we have a single place
// to short-circuit if PostHog isn't initialized (key missing in env).
function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* ignore — SDK not initialized or blocked */
  }
}

/**
 * Step beta — 3-step onboarding form on top of the /api/recommend pipeline.
 *
 * Step 1 — Where you are (stage, field, skills, interests)
 * Step 2 — Your background (studies, past positions, languages)
 * Step 3 — What you're after (salary, location, priority, dream, dilemma)
 *
 * State stays in this component across steps; nothing persists across reloads
 * yet (no localStorage to keep the v1 minimal). Submit POSTs to /api/recommend.
 */

/* ─── Domain types (mirror lib/ai/types.ts) ───────────────────── */

type Stage =
  | "university_student"
  | "recent_grad"
  | "0_3y"
  | "3_7y"
  | "7_plus";

type FieldEnum =
  | "computer_science"
  | "engineering"
  | "business"
  | "economics"
  | "humanities"
  | "social_sciences"
  | "life_sciences"
  | "physical_sciences"
  | "design"
  | "law"
  | "medicine"
  | "other";

type DegreeLevel =
  | "high_school"
  | "bachelor"
  | "master"
  | "msc"
  | "mba"
  | "phd"
  | "postdoc"
  | "bootcamp"
  | "self_taught"
  | "other";

interface Study {
  level: DegreeLevel;
  field: string;
  institution?: string;
}

type CompanyStage =
  | "startup_pre_seed"
  | "startup_seed_a"
  | "startup_b_plus"
  | "scaleup"
  | "corporate"
  | "public_sector"
  | "academia"
  | "freelance"
  | "other";

interface PastPosition {
  title: string;
  companyStage: CompanyStage;
  durationMonths: number;
  description?: string;
}

type LanguageProficiency = "native" | "fluent" | "professional" | "conversational";

interface LanguageRow {
  language: string;
  proficiency: LanguageProficiency;
}

type Currency = "EUR" | "GBP" | "USD";
type PriorityValue = "position" | "money" | "location";

interface ProfileSnapshot {
  stage: Stage;
  field: FieldEnum;
  currentSalary?: number;
  minSalary?: number;
  currency: Currency;
  futureSelf?: string;
  locationPreferred?: string;
}

interface Recommendation {
  title: string;
  rationale: string;
  ninetyDayActions: string[];
  twelveMonthOutcome: string;
  similarProfilePattern: string;
  confidence: { level: "high" | "medium" | "low"; reason: string };
  basedOnPathIds: string[];
}

interface RecommendResult {
  recommendations: Recommendation[];
  honestTake: string;
  whatWeDontKnow: string;
}

interface ApiResponse {
  result: RecommendResult;
  meta: {
    model: string;
    promptVersion: string;
    retrievalCount: number;
    retrievedPathIds: string[];
    tokens: { input: number | null; output: number | null };
    timings: { embedMs: number; retrieveMs: number; llmMs: number; totalMs: number };
  };
}

interface RetrievedPathSummary {
  path_id: string;
  next_role: string;
  transition_type: string;
}

// Deeply-partial during streaming. We render fields as they fill in.
type PartialRecommendation = Partial<{
  title: string;
  rationale: string;
  ninetyDayActions: string[];
  twelveMonthOutcome: string;
  similarProfilePattern: string;
  confidence: { level: "high" | "medium" | "low"; reason: string };
  basedOnPathIds: string[];
}>;

type PartialResult = Partial<{
  recommendations: PartialRecommendation[];
  honestTake: string;
  whatWeDontKnow: string;
}>;

/** A recommendation is "renderable" once every required field is present.
 * During streaming we only show fully-formed cards; partials show as a
 * skeleton row instead. */
function isCompleteRec(r: PartialRecommendation): r is Recommendation {
  return !!(
    r &&
    typeof r.title === "string" &&
    r.title.length > 0 &&
    typeof r.rationale === "string" &&
    r.rationale.length > 0 &&
    Array.isArray(r.ninetyDayActions) &&
    r.ninetyDayActions.length >= 2 &&
    typeof r.twelveMonthOutcome === "string" &&
    r.twelveMonthOutcome.length > 0 &&
    typeof r.similarProfilePattern === "string" &&
    r.similarProfilePattern.length > 0 &&
    r.confidence?.level &&
    typeof r.confidence?.reason === "string" &&
    Array.isArray(r.basedOnPathIds) &&
    r.basedOnPathIds.length >= 1
  );
}

/* ─── Option lists ─────────────────────────────────────────────── */

const STAGE_OPTIONS: Array<{ value: Stage; label: string }> = [
  { value: "university_student", label: "University student" },
  { value: "recent_grad", label: "Recent graduate" },
  { value: "0_3y", label: "0–3 years experience" },
  { value: "3_7y", label: "3–7 years experience" },
  { value: "7_plus", label: "7+ years experience" },
];

const STAGE_SHORT: Record<Stage, string> = {
  university_student: "University student",
  recent_grad: "Recent grad",
  "0_3y": "0–3y experience",
  "3_7y": "3–7y experience",
  "7_plus": "7+ years experience",
};

const FIELD_OPTIONS: Array<{ value: FieldEnum; label: string }> = [
  { value: "computer_science", label: "Computer Science / Software" },
  { value: "engineering", label: "Engineering" },
  { value: "business", label: "Business" },
  { value: "economics", label: "Economics / Finance" },
  { value: "humanities", label: "Humanities" },
  { value: "social_sciences", label: "Social Sciences" },
  { value: "life_sciences", label: "Life Sciences (biology, medicine)" },
  { value: "physical_sciences", label: "Physical Sciences (physics, chemistry)" },
  { value: "design", label: "Design" },
  { value: "law", label: "Law" },
  { value: "medicine", label: "Medicine" },
  { value: "other", label: "Other" },
];

const DEGREE_OPTIONS: Array<{ value: DegreeLevel; label: string }> = [
  { value: "high_school", label: "High School" },
  { value: "bachelor", label: "Bachelor's (BA / BSc)" },
  { value: "master", label: "Master's (MA)" },
  { value: "msc", label: "MSc" },
  { value: "mba", label: "MBA" },
  { value: "phd", label: "PhD" },
  { value: "postdoc", label: "Postdoc" },
  { value: "bootcamp", label: "Bootcamp" },
  { value: "self_taught", label: "Self-taught" },
  { value: "other", label: "Other" },
];

const COMPANY_STAGE_OPTIONS: Array<{ value: CompanyStage; label: string }> = [
  { value: "startup_pre_seed", label: "Startup (pre-seed)" },
  { value: "startup_seed_a", label: "Startup (seed / Series A)" },
  { value: "startup_b_plus", label: "Startup (Series B+)" },
  { value: "scaleup", label: "Scale-up" },
  { value: "corporate", label: "Corporate" },
  { value: "public_sector", label: "Public sector" },
  { value: "academia", label: "Academia" },
  { value: "freelance", label: "Freelance / self-employed" },
  { value: "other", label: "Other" },
];

const PROFICIENCY_OPTIONS: Array<{ value: LanguageProficiency; label: string }> = [
  { value: "native", label: "Native" },
  { value: "fluent", label: "Fluent" },
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
];

// Comprehensive language list — pure picker, no free-text typing.
const LANGUAGE_OPTIONS = [
  "English",
  "Italian",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Dutch",
  "Polish",
  "Greek",
  "Romanian",
  "Czech",
  "Hungarian",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Russian",
  "Ukrainian",
  "Turkish",
  "Arabic",
  "Hebrew",
  "Mandarin",
  "Cantonese",
  "Japanese",
  "Korean",
  "Hindi",
  "Bengali",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Other",
];

const SKILL_SUGGESTIONS = [
  "SQL",
  "Python",
  "JavaScript / TypeScript",
  "Excel modeling",
  "Data analysis",
  "Statistics",
  "Machine learning",
  "Writing",
  "Public speaking",
  "Project management",
  "Stakeholder management",
  "Sales",
  "Cold outreach",
  "A/B testing",
  "Figma",
  "User research",
  "Product discovery",
  "Roadmapping",
  "Mentoring",
  "System design",
  "Team leadership",
  "Negotiation",
  "Marketing",
  "SEO",
  "Growth",
  "Content creation",
  "Customer support",
  "Recruiting",
  "Financial modeling",
  "Legal research",
  "Lab research",
  "Scientific writing",
];

const INTEREST_SUGGESTIONS = [
  "Product strategy",
  "Growth marketing",
  "AI / LLM products",
  "Software engineering at scale",
  "Engineering management",
  "Founding a startup",
  "Joining a startup early",
  "Consulting",
  "Investment / VC",
  "Career change",
  "Higher compensation",
  "Remote work",
  "Relocation abroad",
  "Better work-life balance",
  "Mentoring others",
  "Building in public",
  "Industry pivot",
  "Domain expertise",
  "Public speaking",
  "Writing publicly",
  "Design",
  "User research",
  "Sales / business development",
];

/** Loading messages keyed to elapsed time, not random rotation. The
 * sequence mirrors what's actually happening server-side: embed → retrieve
 * → LLM thinks → LLM writes. Telling users that we're searching real
 * career patterns reframes the wait from "is this broken?" to "this is
 * doing real work". */
function loadingMessageFor(elapsedSec: number): string {
  if (elapsedSec < 5) return "Reading your profile…";
  if (elapsedSec < 12) return "Searching 33 curated career paths…";
  if (elapsedSec < 22) return "Finding profiles similar to yours…";
  if (elapsedSec < 35) return "Drafting recommendations grounded in real patterns…";
  if (elapsedSec < 50) return "Writing the honest take — direct, not polite…";
  return "Finalizing your plan — this takes a bit longer for richer profiles…";
}

const RESULT_STORAGE_KEY = "step:beta:lastResult:v1";

interface PersistedResult {
  data: ApiResponse;
  profile: ProfileSnapshot | null;
  savedAt: number;
}

const MAX_SKILLS = 8;
const MAX_INTERESTS = 5;
const MAX_STUDIES = 5;
const MAX_PAST_POSITIONS = 5;
const MAX_LANGUAGES = 6;

const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: "€",
  GBP: "£",
  USD: "$",
};

/* ─── Page component ──────────────────────────────────────────── */

export default function BetaPage() {
  const [phase, setPhase] = useState<
    "form" | "loading" | "streaming" | "result" | "error"
  >("form");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [stage, setStage] = useState<Stage>("0_3y");
  const [fieldVal, setFieldVal] = useState<FieldEnum>("computer_science");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [interestInput, setInterestInput] = useState("");

  // Step 2
  const [studies, setStudies] = useState<Study[]>([
    { level: "bachelor", field: "" },
  ]);
  const [pastPositions, setPastPositions] = useState<PastPosition[]>([]);
  const [languages, setLanguages] = useState<LanguageRow[]>([
    { language: "English", proficiency: "fluent" },
  ]);

  // Step 3
  const [salaryCurrent, setSalaryCurrent] = useState("");
  const [salaryNotPriority, setSalaryNotPriority] = useState(false);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState<Currency>("EUR");
  const [locationPreferred, setLocationPreferred] = useState("");
  const [openToRemote, setOpenToRemote] = useState(true);
  const [openToRelocation, setOpenToRelocation] = useState(false);
  const [priorityFirst, setPriorityFirst] = useState<PriorityValue>("position");
  const [prioritySecond, setPrioritySecond] = useState<PriorityValue>("money");
  const [priorityThird, setPriorityThird] = useState<PriorityValue>("location");
  const [futureSelf, setFutureSelf] = useState("");
  const [dilemma, setDilemma] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileSnapshot | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  // Streaming state: populated as the NDJSON events arrive.
  const [retrievedPaths, setRetrievedPaths] = useState<RetrievedPathSummary[] | null>(null);
  const [partialResult, setPartialResult] = useState<PartialResult | null>(null);

  // Tick elapsed seconds while loading or streaming.
  useEffect(() => {
    if (phase !== "loading" && phase !== "streaming") return;
    const t = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // On mount, restore last result from localStorage if present. Lets users
  // refresh / close-and-reopen without losing their plan. We trust the
  // stored shape — if it's stale or malformed, we silently drop it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RESULT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedResult;
      if (!parsed?.data?.result?.recommendations?.length) return;
      setResult(parsed.data);
      setProfileSnapshot(parsed.profile);
      setPhase("result");
    } catch {
      // Corrupt entry — clear it so we don't keep tripping on it.
      try {
        window.localStorage.removeItem(RESULT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  /* ─ Step 1 helpers ─ */
  function toggleSkill(s: string) {
    setErrorMsg(null);
    setSkills((current) => {
      if (current.includes(s)) return current.filter((x) => x !== s);
      if (current.length >= MAX_SKILLS) {
        setErrorMsg(`Max ${MAX_SKILLS} skills.`);
        return current;
      }
      return [...current, s];
    });
  }
  function toggleInterest(s: string) {
    setErrorMsg(null);
    setInterests((current) => {
      if (current.includes(s)) return current.filter((x) => x !== s);
      if (current.length >= MAX_INTERESTS) {
        setErrorMsg(`Max ${MAX_INTERESTS} interests.`);
        return current;
      }
      return [...current, s];
    });
  }
  function addCustomSkill() {
    const v = skillInput.trim();
    if (!v) return;
    if (skills.includes(v)) {
      setSkillInput("");
      return;
    }
    if (skills.length >= MAX_SKILLS) {
      setErrorMsg(`Max ${MAX_SKILLS} skills.`);
      return;
    }
    setSkills((s) => [...s, v]);
    setSkillInput("");
  }
  function addCustomInterest() {
    const v = interestInput.trim();
    if (!v) return;
    if (interests.includes(v)) {
      setInterestInput("");
      return;
    }
    if (interests.length >= MAX_INTERESTS) {
      setErrorMsg(`Max ${MAX_INTERESTS} interests.`);
      return;
    }
    setInterests((s) => [...s, v]);
    setInterestInput("");
  }

  /* ─ Step 2 helpers ─ */
  function updateStudy(i: number, patch: Partial<Study>) {
    setStudies((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeStudy(i: number) {
    setStudies((s) => s.filter((_, idx) => idx !== i));
  }
  function addStudy() {
    if (studies.length >= MAX_STUDIES) return;
    setStudies((s) => [...s, { level: "master", field: "" }]);
  }

  function updatePosition(i: number, patch: Partial<PastPosition>) {
    setPastPositions((s) =>
      s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }
  function removePosition(i: number) {
    setPastPositions((s) => s.filter((_, idx) => idx !== i));
  }
  function addPosition() {
    if (pastPositions.length >= MAX_PAST_POSITIONS) return;
    setPastPositions((s) => [
      ...s,
      { title: "", companyStage: "scaleup", durationMonths: 12 },
    ]);
  }

  function updateLanguage(i: number, patch: Partial<LanguageRow>) {
    setLanguages((s) =>
      s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }
  function removeLanguage(i: number) {
    setLanguages((s) => s.filter((_, idx) => idx !== i));
  }
  function addLanguage() {
    if (languages.length >= MAX_LANGUAGES) return;
    // Pick the first not-yet-selected language as default
    const taken = new Set(languages.map((l) => l.language));
    const next =
      LANGUAGE_OPTIONS.find((lang) => !taken.has(lang)) ?? "Other";
    setLanguages((s) => [...s, { language: next, proficiency: "professional" }]);
  }

  /* ─ Validation per step ─ */
  function validateStep1(): string | null {
    if (skills.length === 0) return "Pick at least 1 skill.";
    if (interests.length === 0) return "Pick at least 1 interest.";
    return null;
  }
  function validateStep2(): string | null {
    if (studies.length === 0) return "Add at least 1 study entry.";
    for (const s of studies) {
      if (!s.field.trim()) return "Every study needs a field (e.g. Computer Science).";
    }
    if (languages.length === 0) return "Add at least 1 language.";
    for (const l of languages) {
      if (!l.language.trim()) return "Pick a language for every row.";
    }
    return null;
  }
  function validateStep3(): string | null {
    const set = new Set([priorityFirst, prioritySecond, priorityThird]);
    if (set.size !== 3) return "Each priority must be different (position, money, location).";
    if (salaryCurrent && Number(salaryCurrent) < 0) {
      return "Current salary can't be negative.";
    }
    if (!salaryNotPriority && salaryMin && Number(salaryMin) < 0) {
      return "Salary minimum can't be negative.";
    }
    return null;
  }

  /* ─ Step navigation ─ */
  function goNext() {
    setErrorMsg(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setErrorMsg(err);
        return;
      }
      track("form_step_completed", { step: 1 });
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) {
        setErrorMsg(err);
        return;
      }
      track("form_step_completed", { step: 2 });
      setStep(3);
    }
  }
  function goBack() {
    setErrorMsg(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  /* ─ Submit ─ */
  async function handleSubmit(additionalContextOverride?: string) {
    setErrorMsg(null);
    // Validate only on first submit (form path), not when refining from
    // the result view — the original payload is already valid.
    if (!additionalContextOverride) {
      const err = validateStep3();
      if (err) {
        setErrorMsg(err);
        return;
      }
    }

    const currentSalaryNum = salaryCurrent ? Number(salaryCurrent) : undefined;
    const minSalaryNum =
      salaryNotPriority || !salaryMin ? undefined : Number(salaryMin);

    const payload = {
      stage,
      field: fieldVal,
      skills,
      interests,
      studies,
      pastPositions,
      languages,
      salary: {
        notAPriority: salaryNotPriority,
        current: currentSalaryNum,
        minAcceptable: minSalaryNum,
        currency: salaryCurrency,
      },
      location: {
        preferred: locationPreferred.trim() || undefined,
        openToRemote,
        openToRelocation,
      },
      priorityOrder: {
        first: priorityFirst,
        second: prioritySecond,
        third: priorityThird,
      },
      futureSelf: futureSelf.trim() || undefined,
      dilemma: dilemma.trim() || undefined,
      additionalContext: additionalContextOverride?.trim() || undefined,
      locale: "en" as const,
    };

    // Snapshot the profile for the result view (timeline NOW → vision)
    setProfileSnapshot({
      stage,
      field: fieldVal,
      currentSalary: currentSalaryNum,
      minSalary: minSalaryNum,
      currency: salaryCurrency,
      futureSelf: futureSelf.trim() || undefined,
      locationPreferred: locationPreferred.trim() || undefined,
    });

    setPhase("loading");
    setElapsedSec(0);
    setRetrievedPaths(null);
    setPartialResult(null);
    if (additionalContextOverride) {
      track("plan_refined", {
        contextLength: additionalContextOverride.trim().length,
      });
    } else {
      track("form_submitted", {
        stage,
        field: fieldVal,
        hasFutureSelf: !!futureSelf.trim(),
        hasDilemma: !!dilemma.trim(),
        hasCurrentSalary: !!currentSalaryNum,
      });
    }

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(errBody.message ?? errBody.error ?? `API ${res.status}`);
      }

      if (!res.body) {
        throw new Error("Response has no streaming body");
      }

      // Read NDJSON stream line by line. Each line is one event:
      // retrieved | partial | final | error.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData: ApiResponse | null = null;
      let streamError: string | null = null;

      // Yield once a microtask before the first read so React commits the
      // "loading" phase render — avoids skipping straight to streaming
      // before the loading view ever shows.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: {
            type: string;
            paths?: RetrievedPathSummary[];
            data?: PartialResult;
            result?: RecommendResult;
            meta?: ApiResponse["meta"];
            message?: string;
          };
          try {
            msg = JSON.parse(line);
          } catch (parseErr) {
            console.warn("Failed to parse stream line:", line, parseErr);
            continue;
          }

          if (msg.type === "retrieved" && msg.paths) {
            setRetrievedPaths(msg.paths);
            setPhase("streaming");
          } else if (msg.type === "partial" && msg.data) {
            setPartialResult(msg.data);
          } else if (msg.type === "final" && msg.result && msg.meta) {
            finalData = { result: msg.result, meta: msg.meta };
          } else if (msg.type === "error") {
            streamError = msg.message ?? "Stream error";
          }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!finalData) throw new Error("Stream ended without final result");

      setResult(finalData);
      setPhase("result");
      setPartialResult(null);
      track("result_received", {
        recCount: finalData.result.recommendations.length,
        totalMs: finalData.meta.timings.totalMs,
      });

      // Persist so the user can refresh / close-and-reopen without losing
      // their plan. Best-effort — quotas / private mode silently no-op.
      try {
        const persisted: PersistedResult = {
          data: finalData,
          profile: {
            stage,
            field: fieldVal,
            currentSalary: currentSalaryNum,
            minSalary: minSalaryNum,
            currency: salaryCurrency,
            futureSelf: futureSelf.trim() || undefined,
            locationPreferred: locationPreferred.trim() || undefined,
          },
          savedAt: Date.now(),
        };
        window.localStorage.setItem(
          RESULT_STORAGE_KEY,
          JSON.stringify(persisted),
        );
      } catch {
        /* ignore — storage full / blocked */
      }
    } catch (err) {
      console.error("Submit error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
      track("result_failed", {
        message: err instanceof Error ? err.message.slice(0, 100) : "unknown",
      });
    }
  }

  function handleReset() {
    setPhase("form");
    setStep(1);
    setResult(null);
    setProfileSnapshot(null);
    setRetrievedPaths(null);
    setPartialResult(null);
    setErrorMsg(null);
    try {
      window.localStorage.removeItem(RESULT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /* ─ Render ─ */
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-14">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-ink-200/80 transition hover:opacity-70 dark:text-ink-200/60"
        >
          step.careers
        </Link>
        <span className="rounded-full border border-ink-200/30 px-2.5 py-0.5 text-xs uppercase tracking-wider text-ink-200/60">
          beta
        </span>
      </header>

      {phase === "form" && (
        <>
          <ProgressBar step={step} />

          {errorMsg && (
            <div className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <Step1
              stage={stage}
              setStage={setStage}
              fieldVal={fieldVal}
              setFieldVal={setFieldVal}
              skills={skills}
              interests={interests}
              skillInput={skillInput}
              setSkillInput={setSkillInput}
              interestInput={interestInput}
              setInterestInput={setInterestInput}
              toggleSkill={toggleSkill}
              toggleInterest={toggleInterest}
              addCustomSkill={addCustomSkill}
              addCustomInterest={addCustomInterest}
            />
          )}

          {step === 2 && (
            <Step2
              studies={studies}
              updateStudy={updateStudy}
              removeStudy={removeStudy}
              addStudy={addStudy}
              pastPositions={pastPositions}
              updatePosition={updatePosition}
              removePosition={removePosition}
              addPosition={addPosition}
              languages={languages}
              updateLanguage={updateLanguage}
              removeLanguage={removeLanguage}
              addLanguage={addLanguage}
            />
          )}

          {step === 3 && (
            <Step3
              salaryCurrent={salaryCurrent}
              setSalaryCurrent={setSalaryCurrent}
              salaryNotPriority={salaryNotPriority}
              setSalaryNotPriority={setSalaryNotPriority}
              salaryMin={salaryMin}
              setSalaryMin={setSalaryMin}
              salaryCurrency={salaryCurrency}
              setSalaryCurrency={setSalaryCurrency}
              locationPreferred={locationPreferred}
              setLocationPreferred={setLocationPreferred}
              openToRemote={openToRemote}
              setOpenToRemote={setOpenToRemote}
              openToRelocation={openToRelocation}
              setOpenToRelocation={setOpenToRelocation}
              priorityFirst={priorityFirst}
              setPriorityFirst={setPriorityFirst}
              prioritySecond={prioritySecond}
              setPrioritySecond={setPrioritySecond}
              priorityThird={priorityThird}
              setPriorityThird={setPriorityThird}
              futureSelf={futureSelf}
              setFutureSelf={setFutureSelf}
              dilemma={dilemma}
              setDilemma={setDilemma}
            />
          )}

          <div className="mt-10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1}
              className="rounded-full border border-ink-200/30 px-5 py-2.5 text-sm transition hover:border-ink-200/60 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-full bg-ink-50 px-7 py-3 text-sm font-medium text-ink-950 transition hover:opacity-80"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-full bg-ink-50 px-7 py-3 text-sm font-medium text-ink-950 transition hover:opacity-80"
              >
                Get my next steps
              </button>
            )}
          </div>
        </>
      )}

      {phase === "loading" && (
        <LoadingView
          message={loadingMessageFor(elapsedSec)}
          elapsedSec={elapsedSec}
        />
      )}

      {phase === "streaming" && (
        <StreamingView
          retrievedPaths={retrievedPaths}
          partialResult={partialResult}
          elapsedSec={elapsedSec}
        />
      )}

      {phase === "result" && result && (
        <ResultView
          data={result}
          profile={profileSnapshot}
          onReset={handleReset}
          onRefine={(additional) => handleSubmit(additional)}
        />
      )}

      {phase === "error" && (
        <ErrorView
          message={errorMsg ?? "Something went wrong."}
          onReset={handleReset}
        />
      )}

      <Footer />
    </main>
  );
}

/* ─── Progress bar ─────────────────────────────────────────────── */

function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Where you are", "Your background", "What you're after"];
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition ${
              i <= step
                ? "bg-ink-50"
                : "bg-ink-200/20"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs uppercase tracking-wider text-ink-200/60">
        Step {step} of 3 · {labels[step - 1]}
      </p>
    </div>
  );
}

/* ─── Step 1 ──────────────────────────────────────────────────── */

interface Step1Props {
  stage: Stage;
  setStage: (s: Stage) => void;
  fieldVal: FieldEnum;
  setFieldVal: (f: FieldEnum) => void;
  skills: string[];
  interests: string[];
  skillInput: string;
  setSkillInput: (s: string) => void;
  interestInput: string;
  setInterestInput: (s: string) => void;
  toggleSkill: (s: string) => void;
  toggleInterest: (s: string) => void;
  addCustomSkill: () => void;
  addCustomInterest: () => void;
}

function Step1(p: Step1Props) {
  return (
    <section className="flex flex-col gap-7">
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Where you are now
        </h1>
        <p className="mt-3 text-base text-ink-200/90 dark:text-ink-200/70">
          Your current state. Skills you have, interests you can&apos;t shake.
        </p>
      </div>

      <FieldWrap label="Where are you in your career?">
        <select
          value={p.stage}
          onChange={(e) => p.setStage(e.target.value as Stage)}
          className="form-select"
        >
          {STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldWrap>

      <FieldWrap label="What's your field?">
        <select
          value={p.fieldVal}
          onChange={(e) => p.setFieldVal(e.target.value as FieldEnum)}
          className="form-select"
        >
          {FIELD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldWrap>

      <ChipPicker
        label="What skills do you have today?"
        hint={`Pick up to ${MAX_SKILLS}. Click to toggle. Add your own if missing.`}
        counterText={`${p.skills.length}/${MAX_SKILLS}`}
        suggestions={SKILL_SUGGESTIONS}
        selected={p.skills}
        onToggle={p.toggleSkill}
        inputValue={p.skillInput}
        onInputChange={p.setSkillInput}
        onAddCustom={p.addCustomSkill}
        customPlaceholder="Add another skill…"
      />

      <ChipPicker
        label="What are you drawn to?"
        hint={`Pick up to ${MAX_INTERESTS}.`}
        counterText={`${p.interests.length}/${MAX_INTERESTS}`}
        suggestions={INTEREST_SUGGESTIONS}
        selected={p.interests}
        onToggle={p.toggleInterest}
        inputValue={p.interestInput}
        onInputChange={p.setInterestInput}
        onAddCustom={p.addCustomInterest}
        customPlaceholder="Add another interest…"
      />
    </section>
  );
}

/* ─── Step 2 ──────────────────────────────────────────────────── */

interface Step2Props {
  studies: Study[];
  updateStudy: (i: number, patch: Partial<Study>) => void;
  removeStudy: (i: number) => void;
  addStudy: () => void;
  pastPositions: PastPosition[];
  updatePosition: (i: number, patch: Partial<PastPosition>) => void;
  removePosition: (i: number) => void;
  addPosition: () => void;
  languages: LanguageRow[];
  updateLanguage: (i: number, patch: Partial<LanguageRow>) => void;
  removeLanguage: (i: number) => void;
  addLanguage: () => void;
}

function Step2(p: Step2Props) {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Your background
        </h1>
        <p className="mt-3 text-base text-ink-200/90 dark:text-ink-200/70">
          Education, work history, languages. The signals that distinguish
          your profile from someone with similar skills.
        </p>
      </div>

      {/* Studies */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Studies</span>
          <span className="text-xs text-ink-200/60">
            {p.studies.length}/{MAX_STUDIES}
          </span>
        </div>
        <span className="text-xs text-ink-200/60 dark:text-ink-200/50">
          Highest first. Add multiple if relevant.
        </span>

        {p.studies.map((s, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-ink-200/20 p-3 sm:flex-row sm:items-center"
          >
            <select
              value={s.level}
              onChange={(e) =>
                p.updateStudy(i, { level: e.target.value as DegreeLevel })
              }
              className="form-select sm:w-44"
            >
              {DEGREE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={s.field}
              onChange={(e) => p.updateStudy(i, { field: e.target.value })}
              placeholder="Field of study (e.g. Computer Science)"
              className="form-input flex-1"
              maxLength={120}
            />
            <input
              type="text"
              value={s.institution ?? ""}
              onChange={(e) =>
                p.updateStudy(i, { institution: e.target.value || undefined })
              }
              placeholder="Institution (optional)"
              className="form-input flex-1"
              maxLength={140}
            />
            {p.studies.length > 1 && (
              <button
                type="button"
                onClick={() => p.removeStudy(i)}
                className="self-end text-xs text-red-500 hover:underline sm:self-center"
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {p.studies.length < MAX_STUDIES && (
          <button
            type="button"
            onClick={p.addStudy}
            className="self-start text-sm text-ink-200/70 underline hover:opacity-100"
          >
            + Add another study
          </button>
        )}
      </div>

      {/* Past positions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Past positions (optional)</span>
          <span className="text-xs text-ink-200/60">
            {p.pastPositions.length}/{MAX_PAST_POSITIONS}
          </span>
        </div>
        <span className="text-xs text-ink-200/60 dark:text-ink-200/50">
          Most recent first. Useful especially if you have 1+ years of work
          experience.
        </span>

        {p.pastPositions.map((pos, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-ink-200/20 p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={pos.title}
                onChange={(e) => p.updatePosition(i, { title: e.target.value })}
                placeholder="Job title (e.g. Junior Backend Engineer)"
                className="form-input flex-1"
                maxLength={120}
              />
              <select
                value={pos.companyStage}
                onChange={(e) =>
                  p.updatePosition(i, {
                    companyStage: e.target.value as CompanyStage,
                  })
                }
                className="form-select sm:w-52"
              >
                {COMPANY_STAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={
                  pos.durationMonths
                    ? // Show as years; if exactly N months, render as N/12.
                      // Use up to 1 decimal so 18 months → 1.5 reads cleanly.
                      Math.round((pos.durationMonths / 12) * 10) / 10
                    : ""
                }
                onChange={(e) => {
                  const years = Number(e.target.value);
                  if (Number.isNaN(years) || years <= 0) return;
                  // Schema stores months — round to nearest month.
                  p.updatePosition(i, {
                    durationMonths: Math.max(1, Math.round(years * 12)),
                  });
                }}
                placeholder="Years (e.g. 2.5)"
                min={0.1}
                max={50}
                step={0.5}
                className="form-input w-full sm:w-32"
              />
            </div>
            <input
              type="text"
              value={pos.description ?? ""}
              onChange={(e) =>
                p.updatePosition(i, { description: e.target.value || undefined })
              }
              placeholder="What you did there (one line, optional)"
              className="form-input"
              maxLength={280}
            />
            <button
              type="button"
              onClick={() => p.removePosition(i)}
              className="self-end text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}

        {p.pastPositions.length < MAX_PAST_POSITIONS && (
          <button
            type="button"
            onClick={p.addPosition}
            className="self-start text-sm text-ink-200/70 underline hover:opacity-100"
          >
            + Add a past position
          </button>
        )}
      </div>

      {/* Languages — pure picker, no typing */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Languages</span>
          <span className="text-xs text-ink-200/60">
            {p.languages.length}/{MAX_LANGUAGES}
          </span>
        </div>
        <span className="text-xs text-ink-200/60 dark:text-ink-200/50">
          Critical for relocation/remote signals. Pick from the list.
        </span>

        {p.languages.map((l, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-ink-200/20 p-3 sm:flex-row sm:items-center"
          >
            <select
              value={l.language}
              onChange={(e) => p.updateLanguage(i, { language: e.target.value })}
              className="form-select flex-1"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <select
              value={l.proficiency}
              onChange={(e) =>
                p.updateLanguage(i, {
                  proficiency: e.target.value as LanguageProficiency,
                })
              }
              className="form-select sm:w-44"
            >
              {PROFICIENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {p.languages.length > 1 && (
              <button
                type="button"
                onClick={() => p.removeLanguage(i)}
                className="self-end text-xs text-red-500 hover:underline sm:self-center"
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {p.languages.length < MAX_LANGUAGES && (
          <button
            type="button"
            onClick={p.addLanguage}
            className="self-start text-sm text-ink-200/70 underline hover:opacity-100"
          >
            + Add another language
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── Step 3 ──────────────────────────────────────────────────── */

interface Step3Props {
  salaryCurrent: string;
  setSalaryCurrent: (s: string) => void;
  salaryNotPriority: boolean;
  setSalaryNotPriority: (b: boolean) => void;
  salaryMin: string;
  setSalaryMin: (s: string) => void;
  salaryCurrency: Currency;
  setSalaryCurrency: (c: Currency) => void;
  locationPreferred: string;
  setLocationPreferred: (s: string) => void;
  openToRemote: boolean;
  setOpenToRemote: (b: boolean) => void;
  openToRelocation: boolean;
  setOpenToRelocation: (b: boolean) => void;
  priorityFirst: PriorityValue;
  setPriorityFirst: (p: PriorityValue) => void;
  prioritySecond: PriorityValue;
  setPrioritySecond: (p: PriorityValue) => void;
  priorityThird: PriorityValue;
  setPriorityThird: (p: PriorityValue) => void;
  futureSelf: string;
  setFutureSelf: (s: string) => void;
  dilemma: string;
  setDilemma: (s: string) => void;
}

const PRIORITY_LABELS: Record<PriorityValue, string> = {
  position: "Position / role",
  money: "Money / compensation",
  location: "Location / lifestyle",
};

function Step3(p: Step3Props) {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          What you&apos;re after
        </h1>
        <p className="mt-3 text-base text-ink-200/90 dark:text-ink-200/70">
          Your goals, constraints, and the dream you&apos;re working toward.
          We&apos;ll be honest with you — recommendations have to be grounded
          in where you actually are today.
        </p>
      </div>

      {/* Salary — current + target + currency */}
      <FieldWrap
        label="Salary"
        hint="Current comp anchors realism. We won't promise you a 4x jump if you're at €25k today — but we'll show you the closest move that gets you closer to the dream."
      >
        <div className="flex flex-col gap-3">
          {/* Current salary */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-ink-200/60">
              What do you make today? (annual, gross)
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                value={p.salaryCurrent}
                onChange={(e) => p.setSalaryCurrent(e.target.value)}
                placeholder="e.g. 28000"
                min={0}
                className="form-input flex-1"
              />
              <select
                value={p.salaryCurrency}
                onChange={(e) => p.setSalaryCurrency(e.target.value as Currency)}
                className="form-select w-24"
              >
                <option value="EUR">EUR €</option>
                <option value="GBP">GBP £</option>
                <option value="USD">USD $</option>
              </select>
            </div>
            <span className="text-xs text-ink-200/50">
              Optional but strongly encouraged. We use this to keep recommendations realistic.
            </span>
          </div>

          {/* Target / minimum */}
          <div className="flex flex-col gap-2 border-t border-ink-200/15 pt-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={p.salaryNotPriority}
                onChange={(e) => p.setSalaryNotPriority(e.target.checked)}
              />
              <span>Salary isn&apos;t my top priority for the next role</span>
            </label>
            {!p.salaryNotPriority && (
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-ink-200/60">
                  What&apos;s the minimum you&apos;d accept for the next role?
                </span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={p.salaryMin}
                    onChange={(e) => p.setSalaryMin(e.target.value)}
                    placeholder="e.g. 38000"
                    min={0}
                    className="form-input flex-1"
                  />
                  <span className="flex items-center justify-center rounded-md border border-ink-200/30 px-3 text-sm text-ink-200/60">
                    {CURRENCY_SYMBOL[p.salaryCurrency]} {p.salaryCurrency}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </FieldWrap>

      {/* Location */}
      <FieldWrap label="Location preferences" hint="Cities, countries, or just &quot;EU remote&quot; — be honest.">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={p.locationPreferred}
            onChange={(e) => p.setLocationPreferred(e.target.value)}
            placeholder="e.g. Milan, London, Berlin, or remote EU"
            maxLength={200}
            className="form-input"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.openToRemote}
              onChange={(e) => p.setOpenToRemote(e.target.checked)}
            />
            <span>Open to remote work</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.openToRelocation}
              onChange={(e) => p.setOpenToRelocation(e.target.checked)}
            />
            <span>Open to relocation</span>
          </label>
        </div>
      </FieldWrap>

      {/* Priority order */}
      <FieldWrap label="What matters most?" hint="Rank position, money, and location. We weight recommendations against this.">
        <div className="flex flex-col gap-2">
          {(["First", "Second", "Third"] as const).map((label, idx) => {
            const value =
              idx === 0
                ? p.priorityFirst
                : idx === 1
                  ? p.prioritySecond
                  : p.priorityThird;
            const setter =
              idx === 0
                ? p.setPriorityFirst
                : idx === 1
                  ? p.setPrioritySecond
                  : p.setPriorityThird;
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-16 text-sm text-ink-200/70">{label}</span>
                <select
                  value={value}
                  onChange={(e) => setter(e.target.value as PriorityValue)}
                  className="form-select flex-1"
                >
                  <option value="position">{PRIORITY_LABELS.position}</option>
                  <option value="money">{PRIORITY_LABELS.money}</option>
                  <option value="location">{PRIORITY_LABELS.location}</option>
                </select>
              </div>
            );
          })}
        </div>
      </FieldWrap>

      {/* Future self */}
      <FieldWrap
        label="Where do you see yourself in 5 years? (optional)"
        hint="Be specific — title, comp band, lifestyle, location. The more vivid, the better the recommendation."
      >
        <textarea
          value={p.futureSelf}
          onChange={(e) => p.setFutureSelf(e.target.value)}
          placeholder="e.g. Senior PM at a Series C SaaS, ~€100k base + equity, hybrid in Berlin, leading a 4-person squad."
          rows={3}
          maxLength={800}
          className="form-input"
        />
        <span className="self-end text-xs text-ink-200/50">
          {p.futureSelf.length}/800
        </span>
      </FieldWrap>

      {/* Dilemma */}
      <FieldWrap
        label="What career question can't you stop thinking about? (optional)"
        hint="Be specific. The clearer the dilemma, the sharper the recommendation."
      >
        <textarea
          value={p.dilemma}
          onChange={(e) => p.setDilemma(e.target.value)}
          placeholder="e.g. Junior backend engineer at a Series B fintech, 18 months in. I want to be tech lead in 18-24 months — what do I actually do?"
          rows={4}
          maxLength={500}
          className="form-input"
        />
        <span className="self-end text-xs text-ink-200/50">
          {p.dilemma.length}/500
        </span>
      </FieldWrap>

      <p className="text-xs leading-relaxed text-ink-200/50">
        Privacy: your inputs are stored in your browser session and on our
        infrastructure only to generate your plan. We don&apos;t share or sell
        them. Your email — if you give us one after the result — is used
        for the check-in sequence you opt into.
      </p>
    </section>
  );
}

/* ─── Reusable bits ───────────────────────────────────────────── */

interface ChipPickerProps {
  label: string;
  hint: string;
  counterText: string;
  suggestions: string[];
  selected: string[];
  onToggle: (s: string) => void;
  inputValue: string;
  onInputChange: (s: string) => void;
  onAddCustom: () => void;
  customPlaceholder: string;
}

function ChipPicker(p: ChipPickerProps) {
  const customs = p.selected.filter((s) => !p.suggestions.includes(s));
  const allChips = [...p.suggestions, ...customs];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{p.label}</span>
        <span className="text-xs text-ink-200/60">{p.counterText}</span>
      </div>
      <span className="text-xs text-ink-200/60 dark:text-ink-200/50">
        {p.hint}
      </span>

      <div className="flex flex-wrap gap-2">
        {allChips.map((chip) => {
          const isSelected = p.selected.includes(chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => p.onToggle(chip)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                isSelected
                  ? "border-ink-50 bg-ink-50 text-ink-950"
                  : "border-ink-200/40 bg-transparent text-ink-200/90 hover:border-ink-200/70 dark:text-ink-200/80"
              }`}
            >
              {isSelected ? "✓ " : ""}
              {chip}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex gap-2">
        <input
          type="text"
          value={p.inputValue}
          onChange={(e) => p.onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              p.onAddCustom();
            }
          }}
          placeholder={p.customPlaceholder}
          className="form-input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={p.onAddCustom}
          className="rounded-md border border-ink-200/40 px-3 py-2 text-sm transition hover:border-ink-200/70"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function FieldWrap({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && (
        <span className="text-xs text-ink-200/60 dark:text-ink-200/50">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

function LoadingView({
  message,
  elapsedSec,
}: {
  message: string;
  elapsedSec: number;
}) {
  return (
    <section className="my-auto flex flex-col items-center gap-6 py-16 text-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-ink-200/30 border-t-ink-50"
        aria-label="Loading"
      />
      <p className="text-lg">{message}</p>
      <p className="text-sm text-ink-200/60 dark:text-ink-200/50">
        Claude is generating your plan. Typical: 30–60 seconds — longer
        for richer profiles.
        {elapsedSec > 0 && ` (${elapsedSec}s elapsed)`}
      </p>
    </section>
  );
}

/* ─── Streaming view — partial result rendering as it arrives ─────── */

function StreamingView({
  retrievedPaths,
  partialResult,
  elapsedSec,
}: {
  retrievedPaths: RetrievedPathSummary[] | null;
  partialResult: PartialResult | null;
  elapsedSec: number;
}) {
  const recs = partialResult?.recommendations ?? [];
  const completeRecs = recs.filter(isCompleteRec);
  const inProgressCount = recs.length - completeRecs.length;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 animate-pulse rounded-full bg-emerald-400"
            aria-label="Streaming"
          />
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Generating your plan…
          </h1>
        </div>
        <p className="text-sm text-ink-200/60">
          {completeRecs.length > 0
            ? `${completeRecs.length} recommendation${completeRecs.length === 1 ? "" : "s"} ready · `
            : ""}
          {elapsedSec}s elapsed
        </p>
      </div>

      {retrievedPaths && retrievedPaths.length > 0 && (
        <div className="rounded-xl border border-ink-200/20 bg-ink-200/[0.03] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-200/60">
            Found {retrievedPaths.length} similar profiles in our dataset
          </p>
          <ul className="flex flex-col gap-1 text-sm text-ink-200/80">
            {retrievedPaths.map((p) => (
              <li key={p.path_id} className="flex items-baseline gap-2">
                <code className="rounded bg-ink-200/10 px-1.5 py-0.5 text-xs text-ink-200/70">
                  {p.path_id}
                </code>
                <span className="text-ink-200/50">→</span>
                <span>{p.next_role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completeRecs.length > 0 && (
        <div className="flex flex-col gap-5">
          {completeRecs.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} index={i + 1} />
          ))}
        </div>
      )}

      {inProgressCount > 0 && (
        <div className="rounded-lg border border-dashed border-ink-200/25 p-5">
          <div className="flex items-center gap-3 text-sm text-ink-200/70">
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-ink-200/60"
              aria-hidden="true"
            />
            <span>
              Drafting recommendation {completeRecs.length + 1}
              {recs.length > completeRecs.length + 1
                ? ` of ${recs.length}+`
                : "…"}
            </span>
          </div>
        </div>
      )}

      {partialResult?.honestTake && (
        <div className="rounded-lg border border-ink-200/20 p-5">
          <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
            Honest take
          </h2>
          <p className="mt-3 leading-relaxed">{partialResult.honestTake}</p>
        </div>
      )}

      {partialResult?.whatWeDontKnow && (
        <div className="rounded-lg border border-ink-200/20 p-5">
          <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
            What we don&apos;t know about you
          </h2>
          <p className="mt-3 leading-relaxed">{partialResult.whatWeDontKnow}</p>
        </div>
      )}
    </section>
  );
}

/* ─── Roadmap timeline (top of result) ───────────────────────── */

function trim(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function RoadmapTimeline({
  profile,
  recommendations,
}: {
  profile: ProfileSnapshot | null;
  recommendations: Recommendation[];
}) {
  if (!profile) return null;

  const stageLabel = STAGE_SHORT[profile.stage];
  const sym = CURRENCY_SYMBOL[profile.currency];

  const nowSalary =
    profile.currentSalary !== undefined
      ? `${sym}${profile.currentSalary.toLocaleString()}/yr`
      : null;

  const targetSalary =
    profile.minSalary !== undefined
      ? `${sym}${profile.minSalary.toLocaleString()}+`
      : null;

  // Day 90 — total action count across recs (signal of commitment volume)
  const totalActions = recommendations.reduce(
    (acc, r) => acc + r.ninetyDayActions.length,
    0,
  );
  const top = recommendations[0];

  // Month 12 — top recommendation's outcome (truncated)
  const month12Detail = top
    ? trim(top.twelveMonthOutcome, 95)
    : "First visible outcome";

  // Year 5 — futureSelf, fallback prompt
  const visionRaw = profile.futureSelf?.trim();
  const year5Detail = visionRaw
    ? trim(visionRaw, 110)
    : "Add a 5-year vision (Start over → step 3) to anchor this";

  const milestones: Array<{
    label: string;
    primary: string;
    secondary?: string;
    filled: boolean;
  }> = [
    {
      label: "Now",
      primary: stageLabel,
      secondary:
        [profile.locationPreferred, nowSalary].filter(Boolean).join(" · ") ||
        undefined,
      filled: true,
    },
    {
      label: "Day 90",
      primary: `${totalActions} concrete actions`,
      secondary: top ? trim(top.title, 60) : "Across your top moves",
      filled: false,
    },
    {
      label: "Month 12",
      primary: month12Detail,
      secondary: targetSalary ? `Toward ${targetSalary}` : undefined,
      filled: false,
    },
    {
      label: "Year 5",
      primary: year5Detail,
      secondary: undefined,
      filled: false,
    },
  ];

  return (
    <section
      aria-label="Your career roadmap"
      className="rounded-xl border border-ink-200/25 bg-ink-200/[0.03] p-5 dark:bg-ink-50/[0.02]"
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-200/70">
          Your roadmap
        </h2>
        {top && (
          <span className="text-[10px] uppercase tracking-wider text-ink-200/45">
            anchored to recommendation #1
          </span>
        )}
      </div>

      {/* Connector line behind dots — desktop only */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 top-[5px] hidden h-px bg-gradient-to-r from-ink-50/60 via-ink-200/30 to-ink-200/15 sm:block"
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 sm:gap-3">
          {milestones.map((m) => (
            <Milestone key={m.label} {...m} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Milestone({
  label,
  primary,
  secondary,
  filled,
}: {
  label: string;
  primary: string;
  secondary?: string;
  filled: boolean;
}) {
  return (
    <div className="flex flex-row items-start gap-3 sm:flex-col sm:gap-2">
      <span
        className={`relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0 ${
          filled
            ? "bg-ink-50 ring-4 ring-ink-50/15"
            : "border-2 border-ink-200/40 bg-ink-950"
        }`}
      />
      <div className="flex flex-col gap-1 sm:gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/70">
          {label}
        </span>
        <span className="text-sm font-medium leading-snug">{primary}</span>
        {secondary && (
          <span className="text-xs leading-snug text-ink-200/65 dark:text-ink-200/55">
            {secondary}
          </span>
        )}
      </div>
    </div>
  );
}

function buildPlanMarkdown(
  data: ApiResponse,
  profile: ProfileSnapshot | null,
): string {
  const sym = profile?.currency ? CURRENCY_SYMBOL[profile.currency] : "";
  const lines: string[] = [];
  lines.push("# Your career plan from Step");
  lines.push("");

  if (profile) {
    lines.push("## Where you are");
    lines.push(`- Stage: ${STAGE_SHORT[profile.stage]}`);
    lines.push(`- Field: ${profile.field.replace(/_/g, " ")}`);
    if (profile.currentSalary !== undefined) {
      lines.push(
        `- Current salary: ${sym}${profile.currentSalary.toLocaleString()}/yr`,
      );
    }
    if (profile.minSalary !== undefined) {
      lines.push(
        `- Target minimum: ${sym}${profile.minSalary.toLocaleString()}/yr`,
      );
    }
    if (profile.locationPreferred) {
      lines.push(`- Location: ${profile.locationPreferred}`);
    }
    lines.push("");

    if (profile.futureSelf) {
      lines.push("## Where you want to be (5 years)");
      lines.push(profile.futureSelf);
      lines.push("");
    }
  }

  lines.push("## Recommendations");
  lines.push("");
  data.result.recommendations.forEach((rec, i) => {
    lines.push(`### ${i + 1}. ${rec.title}`);
    lines.push("");
    lines.push(rec.rationale);
    lines.push("");
    lines.push(`**90-day actions:**`);
    rec.ninetyDayActions.forEach((a) => lines.push(`- ${a}`));
    lines.push("");
    lines.push(`**12-month outcome:** ${rec.twelveMonthOutcome}`);
    lines.push("");
    lines.push(`**Similar pattern:** ${rec.similarProfilePattern}`);
    lines.push("");
    lines.push(
      `**Confidence:** ${rec.confidence.level} — ${rec.confidence.reason}`,
    );
    lines.push("");
    lines.push(`**Based on paths:** ${rec.basedOnPathIds.join(", ")}`);
    lines.push("");
  });

  lines.push("## Honest take");
  lines.push("");
  lines.push(data.result.honestTake);
  lines.push("");
  lines.push("## What we don't know about you");
  lines.push("");
  lines.push(data.result.whatWeDontKnow);
  lines.push("");
  lines.push("---");
  lines.push(
    `Generated by step.careers · ${new Date().toISOString().slice(0, 10)}`,
  );

  return lines.join("\n");
}

function ResultView({
  data,
  profile,
  onReset,
  onRefine,
}: {
  data: ApiResponse;
  profile: ProfileSnapshot | null;
  onReset: () => void;
  onRefine: (additional: string) => void;
}) {
  const { result, meta } = data;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "err">("idle");

  async function copyPlan() {
    const md = buildPlanMarkdown(data, profile);
    try {
      await navigator.clipboard.writeText(md);
      setCopyState("copied");
      track("copy_plan_clicked", { length: md.length });
      setTimeout(() => setCopyState("idle"), 2200);
    } catch (err) {
      console.error("Clipboard write failed:", err);
      setCopyState("err");
      setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  return (
    <section className="flex flex-col gap-10">
      <RoadmapTimeline
        profile={profile}
        recommendations={result.recommendations}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Your next steps
          </h1>
          <p className="mt-2 text-sm text-ink-200/60 dark:text-ink-200/50">
            {result.recommendations.length} ranked moves · grounded in{" "}
            {meta.retrievalCount} similar profiles ·{" "}
            {Math.round(meta.timings.totalMs / 1000)}s to generate
          </p>
        </div>
        <button
          type="button"
          onClick={copyPlan}
          className="self-start rounded-full border border-ink-200/40 px-4 py-2 text-sm transition hover:border-ink-50 hover:bg-ink-50/5 sm:self-auto"
          aria-live="polite"
        >
          {copyState === "copied"
            ? "✓ Copied to clipboard"
            : copyState === "err"
              ? "⚠ Copy failed — try again"
              : "Copy plan as text"}
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {result.recommendations.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} index={i + 1} />
        ))}
      </div>

      <div className="rounded-lg border border-ink-200/20 p-5">
        <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
          Honest take
        </h2>
        <p className="mt-3 leading-relaxed">{result.honestTake}</p>
      </div>

      <div className="rounded-lg border border-ink-200/20 p-5">
        <h2 className="text-base font-semibold uppercase tracking-wider text-ink-200/70">
          What we don&apos;t know about you
        </h2>
        <p className="mt-3 leading-relaxed">{result.whatWeDontKnow}</p>
      </div>

      <FillTheGapsBox onRefine={onRefine} />

      <PostResultCTA />

      <button
        onClick={onReset}
        type="button"
        className="self-start text-sm underline opacity-60 hover:opacity-100"
      >
        Start over
      </button>

      <details className="text-xs text-ink-200/50">
        <summary className="cursor-pointer">Debug meta</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-ink-200/10 p-3">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </details>
    </section>
  );
}

/* ─── Fill-the-gaps box — refines plan with additional context ─── */

function FillTheGapsBox({
  onRefine,
}: {
  onRefine: (additional: string) => void;
}) {
  const [text, setText] = useState("");

  const trimmed = text.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 20;
  const ready = trimmed.length >= 20;

  function submit() {
    if (!ready) return;
    onRefine(trimmed);
  }

  return (
    <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.03] p-5">
      <h3 className="text-base font-semibold leading-tight">
        Fill in any gaps to sharpen the plan
      </h3>
      <p className="mt-2 text-sm text-ink-200/70">
        Anything we missed above? Add the missing context — training programme
        constraints, prior product exposure, family situation, risk tolerance,
        anything. We&apos;ll regenerate the plan with it.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I'm in UKFPO Year 2 with a 24-month training contract — I can only exit cleanly at the end of August. I've also been doing a digital health QI project on the side for 6 months."
        rows={4}
        maxLength={1500}
        className="form-input mt-4 text-sm"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-ink-200/50">
          {trimmed.length}/1500
          {tooShort && " · need at least 20 characters"}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="rounded-full bg-ink-50 px-5 py-2 text-sm font-medium text-ink-950 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Refine my plan with this →
        </button>
      </div>
    </div>
  );
}

/* ─── Post-result CTA — email gate + premium intent ──────────── */

function PostResultCTA() {
  const [email, setEmail] = useState("");
  const [wantsPremium, setWantsPremium] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrMsg(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          mostInterestedIn: wantsPremium ? "premium" : "accountability",
          source: "post_result",
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errBody.message ?? `API ${res.status}`);
      }
      setStatus("ok");
      track("email_captured", { wantsPremium });
      if (wantsPremium) track("premium_intent");
    } catch (err) {
      console.error("PostResultCTA submit error:", err);
      setErrMsg(err instanceof Error ? err.message : "Could not save. Try again.");
      setStatus("err");
    }
  }

  if (status === "ok") {
    return (
      <section className="rounded-xl border border-ink-200/30 bg-ink-200/[0.04] p-6 dark:bg-ink-50/[0.03]">
        <h2 className="text-lg font-semibold">You&apos;re in.</h2>
        <p className="mt-2 text-sm text-ink-200/80 dark:text-ink-200/70">
          We&apos;ll email you tomorrow with your first nudge, then ramp down
          (day 1, 2, 4, 7, 14, 21, 30, 45, 60, 90) so the early momentum
          actually happens.
          {wantsPremium &&
            " You also signaled interest in Premium — we'll reach out personally when it opens."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-ink-200/30 bg-ink-200/[0.04] p-6 dark:bg-ink-50/[0.03]">
      <h2 className="text-lg font-semibold leading-tight">
        These are starting points. The work is in the next 90 days.
      </h2>
      <p className="mt-2 text-sm text-ink-200/80 dark:text-ink-200/70">
        Drop your email and we&apos;ll check in 10 times over the next 3
        months — front-loaded at days 1, 2, 4, 7, then weekly to day 30, then
        every 15 days to day 90. The cadence is designed so the first actions
        happen before motivation fades.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="form-input flex-1"
            disabled={status === "sending"}
          />
          <button
            type="submit"
            disabled={status === "sending" || !email.trim()}
            className="rounded-full bg-ink-50 px-6 py-2.5 text-sm font-medium text-ink-950 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "sending" ? "Saving…" : "Get my check-ins"}
          </button>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={wantsPremium}
            onChange={(e) => setWantsPremium(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">I&apos;m interested in Premium.</span>{" "}
            <span className="text-ink-200/70 dark:text-ink-200/60">
              Personalized monthly 1:1 with a senior advisor, CV review tied to
              your plan, and matched job opportunities. Early access pricing
              when it opens.
            </span>
          </span>
        </label>

        {errMsg && (
          <p className="text-xs text-red-500 dark:text-red-400">{errMsg}</p>
        )}
      </form>
    </section>
  );
}

function RecommendationCard({
  rec,
  index,
}: {
  rec: Recommendation;
  index: number;
}) {
  const confidenceColor =
    rec.confidence.level === "high"
      ? "text-green-600 dark:text-green-400"
      : rec.confidence.level === "medium"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <article className="rounded-lg border border-ink-200/20 p-5">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-mono text-ink-200/40">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="text-xl font-semibold leading-tight">{rec.title}</h3>
      </div>

      <p className="mt-2 text-base leading-relaxed">{rec.rationale}</p>

      <div className="mt-5 flex flex-col gap-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
          90-day actions
        </h4>
        <ul className="ml-1 list-disc space-y-1.5 pl-4 text-sm leading-relaxed marker:text-ink-200/40">
          {rec.ninetyDayActions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-col gap-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
          12-month outcome
        </h4>
        <p className="text-sm leading-relaxed">{rec.twelveMonthOutcome}</p>
      </div>

      <div className="mt-5 flex flex-col gap-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
          Similar pattern
        </h4>
        <p className="text-sm leading-relaxed">{rec.similarProfilePattern}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-ink-200/60">
        <span className={`font-semibold ${confidenceColor}`}>
          {rec.confidence.level.toUpperCase()} confidence
        </span>
        <span className="text-ink-200/40">·</span>
        <span>{rec.confidence.reason}</span>
      </div>

      <div className="mt-3 text-xs text-ink-200/40">
        Based on:{" "}
        {rec.basedOnPathIds.map((id, i) => (
          <span key={id}>
            <code className="rounded bg-ink-200/10 px-1.5 py-0.5">{id}</code>
            {i < rec.basedOnPathIds.length - 1 && ", "}
          </span>
        ))}
      </div>

      <FeedbackWidget rec={rec} index={index} />
    </article>
  );
}

/* ─── Feedback widget on each recommendation ───────────────────── */

function FeedbackWidget({
  rec,
  index,
}: {
  rec: Recommendation;
  index: number;
}) {
  // Persist per-rec state across reloads of the same restored result.
  const stateKey = `step:beta:feedback:v1:${index}:${rec.title.slice(0, 40)}`;
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "err">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(stateKey);
      if (raw) {
        const saved = JSON.parse(raw) as { rating: "up" | "down" };
        setRating(saved.rating);
        setSubmitState("saved");
      }
    } catch {
      /* ignore */
    }
  }, [stateKey]);

  async function send(nextRating: "up" | "down", optionalReason?: string) {
    setSubmitState("saving");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: nextRating,
          recommendationIndex: index,
          recommendationTitle: rec.title,
          basedOnPathIds: rec.basedOnPathIds,
          reason: optionalReason?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setSubmitState("saved");
      try {
        window.localStorage.setItem(
          stateKey,
          JSON.stringify({ rating: nextRating }),
        );
      } catch {
        /* ignore */
      }
      track(nextRating === "up" ? "feedback_up" : "feedback_down", {
        recIndex: index,
        hasReason: !!optionalReason?.trim(),
        pathIds: rec.basedOnPathIds.join(","),
      });
    } catch (err) {
      console.error("Feedback submit error:", err);
      setSubmitState("err");
      setTimeout(() => setSubmitState("idle"), 2200);
    }
  }

  function handleClick(next: "up" | "down") {
    if (rating !== null) return; // already rated, no double-click
    setRating(next);
    if (next === "down") {
      // Open reason box for thumbs-down (we want to learn from misses).
      setShowReason(true);
      void send(next); // optimistic — reason arrives separately
    } else {
      void send(next);
    }
  }

  async function submitReason() {
    if (!rating) return;
    await send(rating, reason);
    setShowReason(false);
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-ink-200/15 pt-3">
      <div className="flex items-center gap-3 text-xs text-ink-200/60">
        <span>Was this useful?</span>
        <button
          type="button"
          onClick={() => handleClick("up")}
          disabled={rating !== null}
          aria-label="Useful"
          className={`rounded-full border px-2.5 py-0.5 text-sm transition ${
            rating === "up"
              ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
              : "border-ink-200/30 hover:border-ink-200/60"
          } disabled:cursor-default`}
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => handleClick("down")}
          disabled={rating !== null}
          aria-label="Not useful"
          className={`rounded-full border px-2.5 py-0.5 text-sm transition ${
            rating === "down"
              ? "border-red-400/60 bg-red-400/10 text-red-300"
              : "border-ink-200/30 hover:border-ink-200/60"
          } disabled:cursor-default`}
        >
          👎
        </button>
        {submitState === "saved" && rating !== null && !showReason && (
          <span className="text-ink-200/50">Thanks — recorded.</span>
        )}
        {submitState === "err" && (
          <span className="text-red-400">Couldn&apos;t save — try again.</span>
        )}
      </div>

      {showReason && (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What was off about this? (optional, but really helpful)"
            rows={2}
            maxLength={800}
            className="form-input text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitReason}
              disabled={submitState === "saving"}
              className="rounded-full border border-ink-200/40 px-4 py-1.5 text-xs hover:border-ink-50"
            >
              {submitState === "saving" ? "Saving…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setShowReason(false)}
              className="text-xs text-ink-200/50 underline hover:opacity-100"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorView({
  message,
  onReset,
}: {
  message: string;
  onReset: () => void;
}) {
  return (
    <section className="my-auto flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="max-w-md text-sm text-ink-200/70">{message}</p>
      {message.toLowerCase().includes("timeout") && (
        <p className="max-w-md text-xs text-ink-200/50">
          Heads-up: if the LLM call exceeds Vercel&apos;s function cap, we time
          out. Refresh and try again — most queries fit.
        </p>
      )}
      <button
        onClick={onReset}
        type="button"
        className="rounded-full bg-ink-50 px-5 py-2 text-sm font-medium text-ink-950 hover:opacity-80"
      >
        Try again
      </button>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16 flex flex-col gap-2 text-xs text-ink-200/50 md:flex-row md:justify-between">
      <span>© {new Date().getFullYear()} Step</span>
      <span>Built with care in Italy &amp; the UK.</span>
    </footer>
  );
}
