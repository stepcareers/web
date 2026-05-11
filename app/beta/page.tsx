"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile";

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
  | "nonprofit"
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
  // Added for the decision-tree + scenario-expansion features (Premium).
  // Optional in the type so old persisted snapshots don't crash on hydrate.
  dilemma?: string;
  locale?: "en" | "it";
}

type Leverage = "foundation" | "accelerator" | "optional";

interface Recommendation {
  title: string;
  rationale: string;
  ninetyDayActions: string[];
  twelveMonthOutcome: string;
  similarProfilePattern: string;
  confidence: { level: "high" | "medium" | "low"; reason: string };
  basedOnPathIds: string[];
  leverage: Leverage;
  pathEvidence: string;
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
  starting_role?: string;
  next_role: string;
  transition_type: string;
  timeframe_months?: number;
  locale?: string;
  similarity?: number;
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
  leverage: Leverage;
  pathEvidence: string;
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
    r.basedOnPathIds.length >= 1 &&
    (r.leverage === "foundation" ||
      r.leverage === "accelerator" ||
      r.leverage === "optional") &&
    typeof r.pathEvidence === "string" &&
    r.pathEvidence.length > 0
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
  { value: "nonprofit", label: "Nonprofit / NGO" },
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
  if (elapsedSec < 12) return "Searching 200+ curated career paths…";
  if (elapsedSec < 22) return "Finding profiles similar to yours…";
  if (elapsedSec < 35) return "Drafting recommendations grounded in real patterns…";
  if (elapsedSec < 50) return "Writing the honest take — direct, not polite…";
  return "Finalizing your plan — this takes a bit longer for richer profiles…";
}

// Bumped to v2 when leverage + pathEvidence became required on
// Recommendation. v1 entries lack those fields and would crash the
// new RecommendationCard, so we silently invalidate them.
const RESULT_STORAGE_KEY = "step:beta:lastResult:v2";

/* ─── Premium unlock (decision tree + per-rec scenarios) ──────────
 *
 * Set when the user submits the post-result CTA with the "I'm
 * interested in Premium" checkbox ticked. Acts as an "email/intent
 * gate" until we ship real Stripe payments. Unlocked features:
 *   - Full decision tree (vs locked preview = first stage main line)
 *   - Per-rec scenario expansion (vs locked = no-op)
 *
 * Persisted across sessions on the same device so users who unlocked
 * yesterday don't have to re-submit. Cleared by Start Over alongside
 * the result.
 * ──────────────────────────────────────────────────────────────── */
const PREMIUM_UNLOCK_KEY = "step:premium:unlocked:v1";

function readPremiumUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREMIUM_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

function writePremiumUnlocked(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (v) window.localStorage.setItem(PREMIUM_UNLOCK_KEY, "true");
    else window.localStorage.removeItem(PREMIUM_UNLOCK_KEY);
  } catch {
    /* localStorage may be disabled — silent fail */
  }
}

/**
 * Snapshot of the form input that produced the result. Stored alongside
 * the result so a user who reloads (or comes back from /account, /login)
 * can refine the plan via the Q&A or free-text box without losing the
 * input — the refine flow re-submits the SAME profile + new
 * additionalContext, so without the input, the payload would be
 * empty/default and trip server-side validation.
 *
 * Older persisted entries lack `input` — we hydrate the result without
 * restoring form state in that case, and the refine box silently
 * doesn't work until the user generates a new plan. New format moving
 * forward includes `input` always.
 */
interface PersistedInput {
  stage: Stage;
  fieldVal: FieldEnum;
  skills: string[];
  interests: string[];
  studies: Study[];
  pastPositions: PastPosition[];
  languages: LanguageRow[];
  noIncomeYet: boolean;
  salaryCurrent: string;
  salaryMin: string;
  salaryNotPriority: boolean;
  salaryCurrency: Currency;
  locationPreferred: string;
  openToRemote: boolean;
  openToRelocation: boolean;
  priorityFirst: PriorityValue;
  prioritySecond: PriorityValue;
  priorityThird: PriorityValue;
  futureSelf: string;
  dilemma: string;
}

interface PersistedResult {
  data: ApiResponse;
  profile: ProfileSnapshot | null;
  input?: PersistedInput; // optional for backward compat with older entries
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

interface CvParsed {
  stage?: Stage;
  field?: FieldEnum;
  skills?: string[];
  studies?: Study[];
  pastPositions?: PastPosition[];
  languages?: LanguageRow[];
}

export default function BetaPage() {
  // "intro" is the new entry point: choose CV upload or manual.
  const [phase, setPhase] = useState<
    "intro" | "form" | "loading" | "streaming" | "result" | "error"
  >("intro");
  const [prefilledFromCv, setPrefilledFromCv] = useState(false);
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
  const [noIncomeYet, setNoIncomeYet] = useState(false);
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

  // Cloudflare Turnstile bot-check token. Refreshed on each successful
  // challenge; consumed once by the server. When NEXT_PUBLIC_TURNSTILE_SITE_KEY
  // isn't set the widget no-ops and this stays null — the server-side verifier
  // also no-ops in that case so dev still works.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Ref to the widget so we can imperatively reset() after each submit and
  // get a fresh token for refine/retry. Tokens are single-use server-side.
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

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
  //
  // ALSO restore the form input (skills, interests, futureSelf, ...) if
  // the stored shape includes it — without this, refine (Q&A / free-text)
  // would re-submit empty form state and fail server-side validation
  // ("validation_failed"). Older entries without `input` still work for
  // viewing the plan; refine just won't function until they generate
  // a new one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RESULT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedResult;
      if (!parsed?.data?.result?.recommendations?.length) return;
      setResult(parsed.data);
      setProfileSnapshot(parsed.profile);
      if (parsed.input) {
        const i = parsed.input;
        setStage(i.stage);
        setFieldVal(i.fieldVal);
        setSkills(i.skills ?? []);
        setInterests(i.interests ?? []);
        if (Array.isArray(i.studies) && i.studies.length > 0) {
          setStudies(i.studies);
        }
        setPastPositions(Array.isArray(i.pastPositions) ? i.pastPositions : []);
        if (Array.isArray(i.languages) && i.languages.length > 0) {
          setLanguages(i.languages);
        }
        setNoIncomeYet(!!i.noIncomeYet);
        setSalaryCurrent(i.salaryCurrent ?? "");
        setSalaryMin(i.salaryMin ?? "");
        setSalaryNotPriority(!!i.salaryNotPriority);
        setSalaryCurrency(i.salaryCurrency ?? "EUR");
        setLocationPreferred(i.locationPreferred ?? "");
        setOpenToRemote(!!i.openToRemote);
        setOpenToRelocation(!!i.openToRelocation);
        if (i.priorityFirst) setPriorityFirst(i.priorityFirst);
        if (i.prioritySecond) setPrioritySecond(i.prioritySecond);
        if (i.priorityThird) setPriorityThird(i.priorityThird);
        setFutureSelf(i.futureSelf ?? "");
        setDilemma(i.dilemma ?? "");
      }
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
      { title: "", companyStage: "scaleup", durationMonths: 0 },
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
    for (const pos of pastPositions) {
      if (!pos.title.trim()) {
        return "Every past position needs a job title (or remove the empty row).";
      }
      if (!pos.durationMonths || pos.durationMonths < 1) {
        return "Every past position needs years in role (or remove the empty row).";
      }
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

    // Salary anchor: either a current number, or "no income yet", or
    // "not a priority". Without one, the recommender invents fake bands.
    if (!noIncomeYet && !salaryNotPriority && !salaryCurrent.trim()) {
      return "Tell us your current comp, or check 'I don't have an income yet', or 'salary isn't my top priority'.";
    }
    if (salaryCurrent && Number(salaryCurrent) < 0) {
      return "Current salary can't be negative.";
    }
    if (!salaryNotPriority && salaryMin && Number(salaryMin) < 0) {
      return "Salary minimum can't be negative.";
    }

    // futureSelf: required, ≥40 chars. Without an anchor, recommendations
    // float free of any 5-year direction.
    const fs = futureSelf.trim();
    if (fs.length < 40) {
      return "5-year vision: at least 40 characters. Be specific — title, comp, location, lifestyle.";
    }

    // dilemma: required, ≥30 chars. Without it, recommendations are generic.
    const dl = dilemma.trim();
    if (dl.length < 30) {
      return "Career question: at least 30 characters. Name the actual fork in the road.";
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
    } else {
      // Refine path: state values must be intact. If skills are empty
      // it means we hydrated from an OLD persisted entry (pre-`input`
      // field) and the form values were never restored. Tell the user
      // to start over instead of submitting an invalid payload that
      // would fail Zod validation server-side with a cryptic error.
      if (skills.length === 0 || interests.length === 0 || !futureSelf.trim() || !dilemma.trim()) {
        setErrorMsg(
          "Your form data was lost when the page reloaded. Click 'Start over' below and re-enter your profile to enable refine.",
        );
        return;
      }
    }

    const currentSalaryNum = noIncomeYet
      ? 0
      : salaryCurrent
        ? Number(salaryCurrent)
        : undefined;
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
      // futureSelf and dilemma are required by the schema; validateStep3
      // ensures non-empty before reaching here.
      futureSelf: futureSelf.trim(),
      dilemma: dilemma.trim(),
      additionalContext: additionalContextOverride?.trim() || undefined,
      locale: "en" as const,
      // Bot-check token. The server fails closed when TURNSTILE_SECRET_KEY is set
      // and this is missing/invalid; falls open in dev when no secret is configured.
      turnstileToken: turnstileToken ?? undefined,
    };

    // Snapshot the profile for the result view (timeline NOW → vision,
    // decision-tree, per-rec scenario expansion).
    setProfileSnapshot({
      stage,
      field: fieldVal,
      currentSalary: currentSalaryNum,
      minSalary: minSalaryNum,
      currency: salaryCurrency,
      futureSelf: futureSelf.trim() || undefined,
      locationPreferred: locationPreferred.trim() || undefined,
      dilemma: dilemma.trim() || undefined,
      locale: "en",
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
      // Mirror state in a local var so we can salvage on truncation
      // without racing React's setState batching.
      let latestPartial: PartialResult | null = null;
      let latestRetrieved: RetrievedPathSummary[] = [];

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
            latestRetrieved = msg.paths;
            setRetrievedPaths(msg.paths);
            setPhase("streaming");
          } else if (msg.type === "partial" && msg.data) {
            latestPartial = msg.data;
            setPartialResult(msg.data);
          } else if (msg.type === "final" && msg.result && msg.meta) {
            finalData = { result: msg.result, meta: msg.meta };
          } else if (msg.type === "error") {
            streamError = msg.message ?? "Stream error";
          }
        }
      }

      if (streamError) throw new Error(streamError);

      // Salvage path: if Vercel killed the function at the 60s cap, the
      // 'final' event never fires. But we may already have a complete
      // (or near-complete) plan in the partial — synthesize it.
      if (!finalData && latestPartial) {
        const completeRecs = (latestPartial.recommendations ?? []).filter(
          isCompleteRec,
        );
        const haveHonestTake =
          typeof latestPartial.honestTake === "string" &&
          latestPartial.honestTake.length > 50;
        const haveWhatWeDontKnow =
          typeof latestPartial.whatWeDontKnow === "string" &&
          latestPartial.whatWeDontKnow.length > 20;
        if (completeRecs.length >= 2 && haveHonestTake && haveWhatWeDontKnow) {
          // Salvage path bypasses the server's enforceLeverageCap, so apply
          // the same rule client-side: keep the first foundation, demote
          // the rest to accelerator. Otherwise users on a 60s timeout get
          // 2-foundation plans while normal-path users don't.
          let foundationsSeen = 0;
          const cappedRecs = completeRecs.map((rec) => {
            if (rec.leverage !== "foundation") return rec;
            foundationsSeen += 1;
            if (foundationsSeen === 1) return rec;
            return { ...rec, leverage: "accelerator" as const };
          });

          finalData = {
            result: {
              recommendations: cappedRecs,
              honestTake: latestPartial.honestTake!,
              whatWeDontKnow: latestPartial.whatWeDontKnow!,
            },
            meta: {
              model: "claude-haiku-4-5",
              promptVersion: "recommend@v3",
              retrievalCount: latestRetrieved.length,
              retrievedPathIds: latestRetrieved.map((p) => p.path_id),
              tokens: { input: null, output: null },
              timings: {
                embedMs: 0,
                retrieveMs: 0,
                llmMs: elapsedSec * 1000,
                totalMs: elapsedSec * 1000,
              },
            },
          };
          console.warn(
            "[/api/recommend] salvaged partial result after stream truncation",
            { recCount: completeRecs.length, elapsedSec },
          );
        }
      }

      if (!finalData) {
        throw new Error(
          "Generation took too long (Vercel killed the function at 60s). Try fewer past positions or refine a previous plan instead.",
        );
      }

      setResult(finalData);
      setPhase("result");
      setPartialResult(null);
      track("result_received", {
        recCount: finalData.result.recommendations.length,
        totalMs: finalData.meta.timings.totalMs,
      });

      // Persist so the user can refresh / close-and-reopen without losing
      // their plan. Best-effort — quotas / private mode silently no-op.
      // We persist BOTH the result AND a full snapshot of the form
      // input that produced it, so refine (Q&A or free-text) keeps
      // working after a reload — refine reuses the input as-is.
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
            dilemma: dilemma.trim() || undefined,
            locale: "en",
          },
          input: {
            stage,
            fieldVal,
            skills,
            interests,
            studies,
            pastPositions,
            languages,
            noIncomeYet,
            salaryCurrent,
            salaryMin,
            salaryNotPriority,
            salaryCurrency,
            locationPreferred,
            openToRemote,
            openToRelocation,
            priorityFirst,
            prioritySecond,
            priorityThird,
            futureSelf,
            dilemma,
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
    } finally {
      // Turnstile tokens are single-use — once the server consumes one
      // (or rejects this request), the cached token is dead. Reset the
      // widget so a fresh token is ready in the background by the time
      // the user clicks Refine, retries, or answers a follow-up question.
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  }

  function handleReset() {
    setPhase("intro");
    setStep(1);
    setResult(null);
    setProfileSnapshot(null);
    setRetrievedPaths(null);
    setPartialResult(null);
    setErrorMsg(null);
    setPrefilledFromCv(false);
    try {
      window.localStorage.removeItem(RESULT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /* ─ CV upload prefill ─
   *
   * Defensive normalization: even though /api/parse-cv validates with
   * Zod before responding, we re-shape and guard against subtly bad
   * values that could crash a render (NaN durations from PDF
   * extraction, duplicate language entries, empty strings the renderer
   * doesn't expect). Each setter is wrapped in try/catch so one bad
   * field doesn't break the whole prefill — the user sees a "review
   * carefully" hint instead of a white screen.
   */
  function applyCvParse(parsed: CvParsed) {
    const issues: string[] = [];

    try {
      if (parsed.stage) setStage(parsed.stage);
      if (parsed.field) setFieldVal(parsed.field);
    } catch (e) {
      issues.push("stage/field");
      console.warn("[applyCvParse] stage/field failed", e, parsed);
    }

    try {
      if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
        const cleanSkills = parsed.skills
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, MAX_SKILLS);
        if (cleanSkills.length > 0) setSkills(cleanSkills);
      }
    } catch (e) {
      issues.push("skills");
      console.warn("[applyCvParse] skills failed", e, parsed.skills);
    }

    try {
      if (Array.isArray(parsed.studies) && parsed.studies.length > 0) {
        const cleanStudies = parsed.studies
          .filter(
            (s): s is Study =>
              !!s &&
              typeof s.level === "string" &&
              typeof s.field === "string" &&
              s.field.trim().length > 0,
          )
          .slice(0, MAX_STUDIES);
        if (cleanStudies.length > 0) setStudies(cleanStudies);
      }
    } catch (e) {
      issues.push("studies");
      console.warn("[applyCvParse] studies failed", e, parsed.studies);
    }

    try {
      if (Array.isArray(parsed.pastPositions) && parsed.pastPositions.length > 0) {
        const cleanPositions = parsed.pastPositions
          .filter(
            (pos): pos is PastPosition =>
              !!pos &&
              typeof pos.title === "string" &&
              pos.title.trim().length > 0 &&
              typeof pos.companyStage === "string" &&
              typeof pos.durationMonths === "number" &&
              Number.isFinite(pos.durationMonths) &&
              pos.durationMonths >= 1,
          )
          .slice(0, MAX_PAST_POSITIONS);
        if (cleanPositions.length > 0) setPastPositions(cleanPositions);
      }
    } catch (e) {
      issues.push("pastPositions");
      console.warn("[applyCvParse] pastPositions failed", e, parsed.pastPositions);
    }

    try {
      if (Array.isArray(parsed.languages) && parsed.languages.length > 0) {
        const seen = new Set<string>();
        const cleanLanguages = parsed.languages
          .filter((l): l is LanguageRow => {
            if (!l || typeof l.language !== "string" || !l.language.trim()) return false;
            const key = l.language.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, MAX_LANGUAGES);
        if (cleanLanguages.length > 0) setLanguages(cleanLanguages);
      }
    } catch (e) {
      issues.push("languages");
      console.warn("[applyCvParse] languages failed", e, parsed.languages);
    }

    if (issues.length > 0) {
      // Don't block the prefill — let the user see what we got and
      // edit the rest manually. The amber banner above the form
      // already says "review carefully".
      console.warn("[applyCvParse] some fields skipped:", issues);
    }

    setPrefilledFromCv(true);
    setPhase("form");
    setStep(1);
    track("cv_parsed", {
      hasStage: !!parsed.stage,
      hasField: !!parsed.field,
      skillsCount: parsed.skills?.length ?? 0,
      studiesCount: parsed.studies?.length ?? 0,
      positionsCount: parsed.pastPositions?.length ?? 0,
      languagesCount: parsed.languages?.length ?? 0,
      skippedFields: issues.length > 0 ? issues.join(",") : null,
    });
  }

  function skipCvUpload() {
    setPhase("form");
    setStep(1);
    track("cv_skipped");
  }

  /* ─ Render ─ */
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-14">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-ink-200/80 transition hover:opacity-70 dark:text-ink-200/60"
        >
          step.careers
        </Link>
        <div className="flex items-center gap-3">
          <AuthHeaderLink />
          <span className="rounded-full border border-ink-200/30 px-2.5 py-0.5 text-xs uppercase tracking-wider text-ink-200/60">
            beta
          </span>
        </div>
      </header>

      {phase === "intro" && (
        <CvUpload onParsed={applyCvParse} onSkip={skipCvUpload} />
      )}

      {phase === "form" && (
        <>
          {prefilledFromCv && (
            <div className="mb-6 rounded-md border border-emerald-400/30 bg-emerald-400/[0.05] px-4 py-3 text-sm text-emerald-200/90">
              Pre-filled from your CV. Review each step and edit anything that
              looks off — the form is yours.
            </div>
          )}
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
              noIncomeYet={noIncomeYet}
              setNoIncomeYet={setNoIncomeYet}
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
                className="rounded-full bg-amber-400 px-7 py-3 text-sm font-semibold text-ink-950 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_18px_-12px_rgba(245,158,11,0.55)] transition hover:bg-amber-300"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="rounded-full bg-amber-400 px-7 py-3 text-sm font-semibold text-ink-950 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_18px_-12px_rgba(245,158,11,0.55)] transition hover:bg-amber-300"
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
          onRetry={() => handleSubmit()}
          onReset={handleReset}
        />
      )}

      {/* Bot-check widget. Always mounted at the page level so the imperative
          reset() survives phase transitions (form → loading → streaming →
          result) — refine and retry POST again from the result/error view
          and need a fresh single-use token. Hidden everywhere except where
          the user can submit (Step 3 of the form, or the result view's
          refine actions). Renders null in dev when NEXT_PUBLIC_TURNSTILE_SITE_KEY
          isn't set. */}
      <div
        className={
          (phase === "form" && step === 3) ||
          phase === "result" ||
          phase === "error"
            ? "mt-8 flex justify-end"
            : "hidden"
        }
        aria-hidden={
          !((phase === "form" && step === 3) ||
            phase === "result" ||
            phase === "error")
        }
      >
        <TurnstileWidget
          ref={turnstileRef}
          onToken={setTurnstileToken}
          onExpired={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
        />
      </div>

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
            className="self-start rounded-md border border-dashed border-ink-200/40 px-4 py-2 text-sm text-ink-200/85 transition hover:border-ink-50 hover:bg-ink-50/5"
          >
            + Add another study ({p.studies.length}/{MAX_STUDIES})
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
          Most recent first. Add as many as relevant — up to{" "}
          {MAX_PAST_POSITIONS}. Useful especially if you have 1+ years of work
          experience.
        </span>

        {p.pastPositions.map((pos, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-md border border-ink-200/20 p-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-ink-200/55">
                  Job title
                </span>
                <input
                  type="text"
                  value={pos.title}
                  onChange={(e) => p.updatePosition(i, { title: e.target.value })}
                  placeholder="e.g. Junior Backend Engineer"
                  className="form-input"
                  maxLength={120}
                />
              </label>
              <label className="flex flex-col gap-1 sm:w-52">
                <span className="text-[11px] uppercase tracking-wider text-ink-200/55">
                  Company type
                </span>
                <select
                  value={pos.companyStage}
                  onChange={(e) =>
                    p.updatePosition(i, {
                      companyStage: e.target.value as CompanyStage,
                    })
                  }
                  className="form-select"
                >
                  {COMPANY_STAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 sm:w-36">
                <span className="text-[11px] uppercase tracking-wider text-ink-200/55">
                  Years in role
                </span>
                <input
                  type="number"
                  value={
                    pos.durationMonths
                      ? Math.round((pos.durationMonths / 12) * 10) / 10
                      : ""
                  }
                  onChange={(e) => {
                    const years = Number(e.target.value);
                    if (Number.isNaN(years) || years <= 0) return;
                    p.updatePosition(i, {
                      durationMonths: Math.max(1, Math.round(years * 12)),
                    });
                  }}
                  placeholder="e.g. 2.5"
                  min={0.1}
                  max={50}
                  step={0.5}
                  className="form-input"
                />
              </label>
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
            className="self-start rounded-md border border-dashed border-ink-200/40 px-4 py-2 text-sm text-ink-200/85 transition hover:border-ink-50 hover:bg-ink-50/5"
          >
            {p.pastPositions.length === 0
              ? "+ Add a past position"
              : `+ Add another past position (${p.pastPositions.length}/${MAX_PAST_POSITIONS})`}
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
            className="self-start rounded-md border border-dashed border-ink-200/40 px-4 py-2 text-sm text-ink-200/85 transition hover:border-ink-50 hover:bg-ink-50/5"
          >
            + Add another language ({p.languages.length}/{MAX_LANGUAGES})
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
  noIncomeYet: boolean;
  setNoIncomeYet: (b: boolean) => void;
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

      {/* Salary — current + target + currency. Required to anchor realism. */}
      <FieldWrap
        label="Salary *"
        hint="Current comp anchors realism. We won't promise you a 4x jump if you're at €25k today — but we'll show you the closest move that gets you closer to the dream. Required: enter a number, check 'no income yet', or check 'not my top priority'."
      >
        <div className="flex flex-col gap-3">
          {/* Current salary */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wider text-ink-200/60">
              What do you make today? (annual, gross)
            </span>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={p.noIncomeYet}
                onChange={(e) => {
                  p.setNoIncomeYet(e.target.checked);
                  if (e.target.checked) p.setSalaryCurrent("");
                }}
              />
              <span>
                I don&apos;t have an income yet (student, between roles, on a
                break)
              </span>
            </label>

            {!p.noIncomeYet && (
              <>
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
                    onChange={(e) =>
                      p.setSalaryCurrency(e.target.value as Currency)
                    }
                    className="form-select w-24"
                  >
                    <option value="EUR">EUR €</option>
                    <option value="GBP">GBP £</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
                <span className="text-xs text-ink-200/50">
                  Required. We use this as a realism anchor — without a
                  number we&apos;d be inventing fake salary bands. Tick the
                  no-income box above if it&apos;s literally zero.
                </span>
              </>
            )}
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

      {/* Priority order — required */}
      <FieldWrap label="What matters most? *" hint="Rank position, money, and location. We weight recommendations against this. Each must be different.">
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

      {/* Future self — required */}
      <FieldWrap
        label="Where do you see yourself in 5 years? *"
        hint="Be specific — title, comp band, lifestyle, location. Min 40 characters. The more vivid, the better the recommendation."
      >
        <textarea
          value={p.futureSelf}
          onChange={(e) => p.setFutureSelf(e.target.value)}
          placeholder="e.g. Senior PM at a Series C SaaS, ~€100k base + equity, hybrid in Berlin, leading a 4-person squad."
          rows={3}
          maxLength={800}
          className="form-input"
        />
        <span
          className={`self-end text-xs ${
            p.futureSelf.trim().length < 40
              ? "text-amber-400/80"
              : "text-ink-200/50"
          }`}
        >
          {p.futureSelf.length}/800 · min 40
        </span>
      </FieldWrap>

      {/* Dilemma — required */}
      <FieldWrap
        label="What career question can't you stop thinking about? *"
        hint="Be specific. Min 30 characters. The clearer the dilemma, the sharper the recommendation."
      >
        <textarea
          value={p.dilemma}
          onChange={(e) => p.setDilemma(e.target.value)}
          placeholder="e.g. Junior backend engineer at a Series B fintech, 18 months in. I want to be tech lead in 18-24 months — what do I actually do?"
          rows={4}
          maxLength={500}
          className="form-input"
        />
        <span
          className={`self-end text-xs ${
            p.dilemma.trim().length < 30
              ? "text-amber-400/80"
              : "text-ink-200/50"
          }`}
        >
          {p.dilemma.length}/500 · min 30
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

/* ─── Auth-aware header link ──────────────────────────────────────
 *
 * Anonymous: "Sign in" → /login.
 * Authenticated: "Account" → /account (which shows email + history).
 * Loading: render nothing to avoid layout flash.
 * ──────────────────────────────────────────────────────────────── */

function AuthHeaderLink() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;
  if (session?.user) {
    return (
      <Link
        href="/account"
        className="text-xs font-medium text-ink-200/80 underline-offset-4 transition hover:underline"
      >
        Account
      </Link>
    );
  }
  return (
    <Link
      href="/login"
      className="text-xs font-medium text-ink-200/80 underline-offset-4 transition hover:underline"
    >
      Sign in
    </Link>
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

/* ─── CV upload (intro phase) ──────────────────────────────────── */

function CvUpload({
  onParsed,
  onSkip,
}: {
  onParsed: (parsed: CvParsed) => void;
  onSkip: () => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<"idle" | "parsing" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const trimmedText = text.trim();
  const hasFile = !!file;
  const hasText = trimmedText.length >= 100;
  const tooShortText = trimmedText.length > 0 && !hasText;
  const ready = (hasFile || hasText) && status !== "parsing";

  function pickFile(f: File | null) {
    setErrMsg(null);
    if (!f) {
      setFile(null);
      return;
    }
    const lower = f.name.toLowerCase();
    const okType =
      f.type === "application/pdf" ||
      f.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lower.endsWith(".pdf") ||
      lower.endsWith(".docx");
    if (!okType) {
      setErrMsg("Unsupported file type. Use PDF or DOCX (or paste text).");
      setStatus("err");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg("File is too large. Max 10MB.");
      setStatus("err");
      return;
    }
    setFile(f);
    setStatus("idle");
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    pickFile(f);
  }

  async function submit() {
    if (!ready) return;
    setStatus("parsing");
    setErrMsg(null);
    try {
      let res: Response;
      // File takes precedence if both are present.
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/parse-cv", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/parse-cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmedText }),
        });
      }
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errBody.message ?? `API ${res.status}`);
      }
      const data = (await res.json()) as { parsed: CvParsed };
      onParsed(data.parsed);
    } catch (err) {
      console.error("CV parse error:", err);
      setErrMsg(
        err instanceof Error
          ? err.message
          : "Couldn't parse the CV. Try the manual form.",
      );
      setStatus("err");
    }
  }

  return (
    <section className="flex flex-col gap-7">
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Have a CV? Skip the typing.
        </h1>
        <p className="mt-3 text-base text-ink-200/90 dark:text-ink-200/70">
          Drop a PDF or DOCX, or paste the text. We&apos;ll pre-fill the form
          — stage, field, skills, education, past positions, languages. You
          review and edit in the next step. Takes 5 seconds.
        </p>
      </div>

      {/* Drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-ink-50 bg-ink-50/[0.06]"
            : file
              ? "border-emerald-400/50 bg-emerald-400/[0.04]"
              : "border-ink-200/35 bg-ink-200/[0.02] hover:border-ink-200/60"
        }`}
      >
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="sr-only"
          disabled={status === "parsing"}
        />
        {file ? (
          <>
            <span className="text-base font-medium text-emerald-300">
              ✓ {file.name}
            </span>
            <span className="text-xs text-ink-200/60">
              {(file.size / 1024).toFixed(0)} KB · click to change file
            </span>
          </>
        ) : (
          <>
            <span className="text-base font-medium">
              Drop your CV here, or click to choose
            </span>
            <span className="text-xs text-ink-200/55">
              PDF or DOCX · up to 10MB
            </span>
          </>
        )}
      </label>

      {/* Or paste text */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-ink-200/40">
          <span className="h-px flex-1 bg-ink-200/15" />
          <span>or paste text</span>
          <span className="h-px flex-1 bg-ink-200/15" />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your CV here. LinkedIn export, plain text, or a copy-paste from your CV doc."
          rows={6}
          maxLength={20000}
          className="form-input min-h-[8rem] text-sm leading-relaxed"
          disabled={status === "parsing" || hasFile}
        />
        <div className="flex items-center justify-between text-xs text-ink-200/50">
          <span>
            {hasFile ? (
              <span className="text-ink-200/40">
                Disabled — file selected above
              </span>
            ) : (
              <>
                {trimmedText.length}/20000
                {tooShortText && " · need at least 100 characters"}
              </>
            )}
          </span>
          <span>Privacy: processed in memory, not stored.</span>
        </div>
      </div>

      {errMsg && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errMsg}
        </div>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-ink-200/60 underline hover:text-ink-200/90"
          disabled={status === "parsing"}
        >
          Or fill the form manually →
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="rounded-full bg-amber-400 px-7 py-3 text-sm font-semibold text-ink-950 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_18px_-12px_rgba(245,158,11,0.55)] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-ink-200/40 disabled:text-ink-950/50 disabled:shadow-none"
        >
          {status === "parsing"
            ? "Reading your CV…"
            : "Pre-fill from CV →"}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink-200/50">
        The parser is conservative — it only fills what it can read, leaves
        the rest blank for you to add. If your PDF is a scan/image (not
        text-selectable), it can&apos;t read it; paste the text instead.
      </p>
    </section>
  );
}

function LoadingView({
  message,
  elapsedSec,
}: {
  message: string;
  elapsedSec: number;
}) {
  // The actual pipeline phases (embed → retrieve → generate) run on the
  // server, and the client doesn't receive a server-side event until the
  // first "retrieved" message lands (typically <1s in). So this is a
  // *perceptual* progress indicator — it advances on a fixed timer so the
  // user feels the system is doing something rather than staring at a
  // spinner. Once the server starts streaming, this view is replaced by
  // StreamingView so the real path data takes over.
  const phases = [
    { at: 0, label: "Embedding your profile" },
    { at: 1, label: "Searching 8,500+ paths" },
    { at: 3, label: "Drafting your plan with Claude" },
  ];
  const activeIndex = phases.reduce(
    (acc, p, i) => (elapsedSec >= p.at ? i : acc),
    0,
  );

  return (
    <section className="my-auto flex flex-col items-center gap-8 py-16">
      <div className="flex items-center gap-4">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400/25 border-t-amber-400"
          aria-label="Loading"
        />
        <p className="text-lg font-medium">{message}</p>
      </div>

      <ol className="flex flex-col gap-2.5 text-sm">
        {phases.map((p, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={p.label}
              className={`flex items-center gap-3 transition-opacity ${
                done || active ? "opacity-100" : "opacity-40"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  done
                    ? "bg-amber-400/20 text-amber-300"
                    : active
                      ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40"
                      : "border border-ink-200/30 text-ink-200/50"
                }`}
                aria-hidden
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={active ? "text-ink-50" : "text-ink-200/75"}>
                {p.label}
                {active && (
                  <span className="ml-1 inline-block animate-pulse text-amber-300">
                    …
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-ink-200/50">
        Typical run: 30–60s · richer profiles take longer
        {elapsedSec > 0 && ` · ${elapsedSec}s elapsed`}
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
            className="h-3 w-3 animate-pulse rounded-full bg-amber-400"
            aria-label="Streaming"
          />
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Generating your plan
            <span className="ml-1 inline-block animate-pulse text-amber-400">
              …
            </span>
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
            <RecommendationCard
              key={i}
              rec={rec}
              index={i + 1}
              profile={null}
            />
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
    lines.push(`### ${i + 1}. ${rec.title}  [${rec.leverage}]`);
    lines.push("");
    lines.push(rec.rationale);
    lines.push("");
    lines.push(`**Evidence:** ${rec.pathEvidence}`);
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

function MethodologyCard({ meta }: { meta: ApiResponse["meta"] }) {
  const [expanded, setExpanded] = useState(false);
  const paths = meta.retrievedPathIds ?? [];

  return (
    <section className="rounded-lg border border-ink-200/20">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-ink-200/[0.02]"
        aria-expanded={expanded}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
            How this plan was computed
          </span>
          <span className="text-sm text-ink-200/80">
            {paths.length} curated career paths matched · grounded in real
            patterns, not invented odds
          </span>
        </span>
        <span className="text-xl text-ink-200/60">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="border-t border-ink-200/15 px-5 py-5">
          <p className="text-sm leading-relaxed text-ink-200/85">
            We embedded your profile (stage, field, skills, education, vision,
            dilemma) with Voyage AI, then retrieved the {paths.length} most
            similar real career paths from our curated dataset of 200+ paths
            using cosine distance on pgvector. Each recommendation cites
            which of those paths supported it (see the path slugs on each
            card).
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-200/85">
            We deliberately don&apos;t generate probability percentages.
            With ~200 paths and no control group, any &ldquo;+38% chance&rdquo;
            number would be invented. Instead each move carries a leverage
            tag (foundation / accelerator / optional) and an evidence count
            from the retrieved paths — that&apos;s the honest version of
            &ldquo;how much does this matter?&rdquo;
          </p>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-200/60">
            Matched profiles
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {paths.map((id) => (
              <li
                key={id}
                className="flex items-baseline gap-2 text-ink-200/85"
              >
                <code className="rounded bg-ink-200/10 px-1.5 py-0.5 text-xs text-ink-200/70">
                  {id}
                </code>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs text-ink-200/55">
            Generation: {meta.model} · {Math.round(meta.timings.totalMs / 1000)}
            s · {meta.tokens.input ?? "?"} input tokens, {meta.tokens.output ?? "?"} output tokens · prompt {meta.promptVersion}
          </p>
        </div>
      )}
    </section>
  );
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

      <div className="flex flex-col gap-8">
        {result.recommendations.map((rec, i) => (
          <RecommendationCard
            key={i}
            rec={rec}
            index={i + 1}
            profile={profile}
          />
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

      <DecisionTreeBox
        recommendations={result.recommendations}
        profile={profile}
        retrievedPathIds={meta.retrievedPathIds ?? []}
      />

      <FollowUpQuestionsBox
        whatWeDontKnow={result.whatWeDontKnow}
        recommendationTitles={result.recommendations.map((r) => r.title)}
        onRefine={onRefine}
      />

      <FillTheGapsBox onRefine={onRefine} />

      <PremiumCard />

      <PostResultCTA />

      <MethodologyCard meta={meta} />

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

/* ─── Premium card — standalone CTA shown above the email form ───
 *
 * Visible to free users (hidden once unlocked since they've already
 * captured the offer). Lists 3 concrete value props with the same
 * gradient styling as the in-content unlock buttons, so the user
 * connects "the lock I clicked" with "this card."
 * ──────────────────────────────────────────────────────────────── */

function PremiumCard() {
  const unlocked = usePremiumUnlocked();
  if (unlocked) return null;
  return (
    <section className="rounded-xl border border-purple-400/40 bg-gradient-to-br from-purple-500/[0.08] via-fuchsia-500/[0.06] to-purple-400/[0.04] p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold leading-tight">
          Want the deeper plan?
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-300/80">
          Premium
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-200/80">
        The free plan tells you what to do. Premium tells you what happens
        next, where it could break, and how to course-correct.
      </p>

      <ul className="mt-4 flex flex-col gap-2.5 text-sm">
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 text-purple-300">●</span>
          <span>
            <span className="font-medium">Full decision tree</span> — NOW →
            DAY 90 → MONTH 6 → MONTH 18 → YEAR 5 with branches at every
            stage and 3 outcome scenarios at the end.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 text-purple-300">●</span>
          <span>
            <span className="font-medium">Scenario expansion per rec</span>{" "}
            — for each of the 4 recommendations, the 3-month / 12-month /
            5-year state plus risks and tradeoffs.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 text-purple-300">●</span>
          <span>
            <span className="font-medium">Coming soon</span> — personalized
            monthly 1:1 with a senior advisor, CV review tied to your plan,
            and matched job opportunities.
          </span>
        </li>
      </ul>

      <button
        type="button"
        onClick={() => {
          track("premium_card_clicked");
          scrollToPremiumCTA();
        }}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:opacity-90 hover:shadow-purple-500/30"
      >
        <span>Get early access</span>
        <span aria-hidden>→</span>
      </button>
      <p className="mt-3 text-xs text-ink-200/55">
        Drop your email below + tell us what you&apos;d pay. We&apos;ll
        reach out personally when Premium opens.
      </p>
    </section>
  );
}

/* ─── Premium unlock helpers ───────────────────────────────────── */

function scrollToPremiumCTA() {
  if (typeof document === "undefined") return;
  const el = document.getElementById("post-result-cta");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // Auto-tick the Premium checkbox + focus willingToPay if it's already
  // rendered. Slight delay to let scroll settle.
  setTimeout(() => {
    const checkboxes = Array.from(
      el.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
    );
    const premiumCheck = checkboxes.find((cb) =>
      cb
        .closest("label")
        ?.textContent?.toLowerCase()
        .includes("interested in premium"),
    );
    if (premiumCheck && !premiumCheck.checked) premiumCheck.click();
    const emailInput = el.querySelector<HTMLInputElement>("input[type=email]");
    if (emailInput && !emailInput.value) emailInput.focus();
  }, 350);
}

/* ─── Hook: subscribes a component to premium unlock state ─────── */

function usePremiumUnlocked(): boolean {
  const { data: session, status } = useSession();
  const [unlocked, setUnlocked] = useState<boolean>(() =>
    readPremiumUnlocked(),
  );

  // Listen for in-page unlocks (PostResultCTA submit) and cross-tab
  // localStorage changes.
  useEffect(() => {
    function onUnlock() {
      setUnlocked(readPremiumUnlocked());
    }
    window.addEventListener("step:premium:unlocked", onUnlock);
    window.addEventListener("storage", onUnlock);
    return () => {
      window.removeEventListener("step:premium:unlocked", onUnlock);
      window.removeEventListener("storage", onUnlock);
    };
  }, []);

  // Authenticated user → check the server for previously-signaled
  // Premium intent on this email (could have been from a previous
  // device or after clearing cookies). If found, auto-unlock locally
  // so the user doesn't see the CTA again.
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    if (readPremiumUnlocked()) return; // already unlocked locally
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/premium-status");
        if (!res.ok) return;
        const data = (await res.json()) as { premium: boolean };
        if (cancelled) return;
        if (data.premium) {
          writePremiumUnlocked(true);
          window.dispatchEvent(new Event("step:premium:unlocked"));
        }
      } catch {
        // Best-effort sync; on failure the local state stays put.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email]);

  return unlocked;
}

/* ─── Decision Tree box — Premium-gated post-result feature ────────
 *
 * Auto-fetches the decision tree on result render. Free users see only
 * the first stage's "main" line as preview; the rest is rendered with a
 * frosted-glass overlay + unlock CTA. Premium-unlocked users see the
 * full tree (3 stages with branches + year-5 scenarios + early pivot
 * signals).
 *
 * Unlock signal: localStorage `step:premium:unlocked:v1` = "true",
 * set when PostResultCTA is submitted with wantsPremium ticked. We
 * subscribe via custom event so the unlock is reactive without reload.
 * ──────────────────────────────────────────────────────────────── */

interface DecisionTreeStage {
  label: string;
  main: string;
  branches: { trigger: string; outcome: string }[];
}

interface DecisionTreeData {
  anchorTitle: string;
  anchorLeverage: string;
  stages: DecisionTreeStage[];
  endScenarios: { best: string; base: string; worst: string };
  earlyPivotSignals: string[];
}

function DecisionTreeBox({
  recommendations,
  profile,
  retrievedPathIds,
}: {
  recommendations: Recommendation[];
  profile: ProfileSnapshot | null;
  retrievedPathIds: string[];
}) {
  const unlocked = usePremiumUnlocked();
  const [tree, setTree] = useState<DecisionTreeData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "err">("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Anchor the tree on the FOUNDATION rec (or rank-1 rec as fallback).
  const foundationRec =
    recommendations.find((r) => r.leverage === "foundation") ??
    recommendations[0];

  useEffect(() => {
    if (!foundationRec || !profile) {
      setStatus("err");
      setErrMsg("Missing foundation recommendation or profile.");
      return;
    }
    let cancelled = false;
    async function fetchTree() {
      try {
        const res = await fetch("/api/decision-tree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            foundationRec: {
              title: foundationRec!.title,
              rationale: foundationRec!.rationale,
              leverage: foundationRec!.leverage,
              pathEvidence: foundationRec!.pathEvidence,
              twelveMonthOutcome: foundationRec!.twelveMonthOutcome,
              ninetyDayActions: foundationRec!.ninetyDayActions,
            },
            profile: {
              stage: profile!.stage,
              field: profile!.field,
              futureSelf: profile!.futureSelf,
              dilemma: profile!.dilemma,
              locale: profile!.locale ?? "en",
            },
            retrievedPathSlugs: retrievedPathIds.slice(0, 8),
          }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(errBody.message ?? `API ${res.status}`);
        }
        const data = (await res.json()) as { tree: DecisionTreeData };
        if (cancelled) return;
        setTree(data.tree);
        setStatus("ready");
        track("decision_tree_loaded", {
          stagesCount: data.tree.stages.length,
          anchor: data.tree.anchorLeverage,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("DecisionTreeBox fetch error:", err);
        setErrMsg(
          err instanceof Error ? err.message : "Couldn't load the tree.",
        );
        setStatus("err");
      }
    }
    fetchTree();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onUnlockClick() {
    track("decision_tree_lock_clicked");
    scrollToPremiumCTA();
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-purple-400/30 bg-purple-400/[0.04] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold leading-tight">
            🌳 Your decision tree
          </h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-300/80">
            Premium
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-200/70">
          Mapping NOW → DAY 90 → MONTH 6 → MONTH 18 → YEAR 5 around your
          foundation move…
        </p>
      </div>
    );
  }

  if (status === "err" || !tree) {
    return (
      <div className="rounded-lg border border-ink-200/20 bg-ink-200/[0.02] p-3 text-xs text-ink-200/50">
        Couldn&apos;t load the decision tree
        {errMsg ? `: ${errMsg}` : ""}.
      </div>
    );
  }

  // Both locked + unlocked share the header. Locked shows preview of
  // stage 1 only with a fade overlay over the rest; unlocked shows
  // everything in clear.
  return (
    <div className="rounded-lg border border-purple-400/30 bg-purple-400/[0.04] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold leading-tight">
          🌳 Your decision tree
        </h3>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-300/80">
          Premium
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-200/70">
        Anchored on:{" "}
        <span className="font-medium text-ink-200/90">{tree.anchorTitle}</span>
      </p>

      {/* Always-visible: stage 1 main line (the preview) */}
      <div className="mt-4 rounded-md border border-ink-200/15 bg-ink-200/[0.03] p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
          {tree.stages[0]?.label ?? "NOW → DAY 90"}
        </div>
        <p className="mt-2 text-sm leading-relaxed">{tree.stages[0]?.main}</p>
      </div>

      {unlocked ? (
        <>
          {/* Stage 1 branches + remaining 2 stages */}
          {(tree.stages[0]?.branches ?? []).length > 0 && (
            <div className="mt-2 ml-3 flex flex-col gap-2">
              {tree.stages[0]!.branches.map((b, i) => (
                <BranchRow key={i} branch={b} />
              ))}
            </div>
          )}
          {tree.stages.slice(1).map((s, i) => (
            <div
              key={i}
              className="mt-4 rounded-md border border-ink-200/15 bg-ink-200/[0.03] p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
                {s.label}
              </div>
              <p className="mt-2 text-sm leading-relaxed">{s.main}</p>
              {s.branches.length > 0 && (
                <div className="mt-3 ml-3 flex flex-col gap-2">
                  {s.branches.map((b, j) => (
                    <BranchRow key={j} branch={b} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Year-5 scenarios */}
          <div className="mt-4 rounded-md border border-purple-400/30 bg-purple-400/[0.05] p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-purple-200/80">
              Year 5 — three scenarios
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
                  Best
                </div>
                <p className="mt-1 text-sm leading-relaxed">
                  {tree.endScenarios.best}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/70">
                  Base
                </div>
                <p className="mt-1 text-sm leading-relaxed">
                  {tree.endScenarios.base}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
                  Worst
                </div>
                <p className="mt-1 text-sm leading-relaxed">
                  {tree.endScenarios.worst}
                </p>
              </div>
            </div>
          </div>

          {/* Pivot signals */}
          <div className="mt-4 rounded-md border border-ink-200/15 bg-ink-200/[0.03] p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-200/60">
              Pivot signals — when to bail early
            </div>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed marker:text-ink-200/40">
              {tree.earlyPivotSignals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* Locked teaser: show 1-2 truncated branches as fade hint */}
          {(tree.stages[0]?.branches ?? []).slice(0, 1).map((b, i) => (
            <div
              key={i}
              className="mt-2 ml-3 text-sm leading-relaxed text-ink-200/55"
              style={{
                maskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,1) 20%, rgba(0,0,0,0.15) 90%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,1) 20%, rgba(0,0,0,0.15) 90%)",
              }}
            >
              <span className="text-purple-300/70">↳ If</span> {b.trigger}…
            </div>
          ))}

          <div className="mt-5 rounded-lg border border-purple-400/50 bg-gradient-to-br from-purple-500/[0.10] via-fuchsia-500/[0.07] to-purple-400/[0.05] p-5">
            <p className="text-base font-semibold leading-snug">
              You&apos;re seeing 1 of 3 stages.
            </p>
            <p className="mt-1 text-sm text-ink-200/80">
              Unlock {tree.stages.length - 1} more stages with branches, three
              Year-5 scenarios (best / base / worst), and{" "}
              {tree.earlyPivotSignals.length} early-pivot signals.
            </p>
            <button
              type="button"
              onClick={onUnlockClick}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:opacity-90 hover:shadow-purple-500/30"
            >
              <span>Unlock with Premium</span>
              <span aria-hidden>→</span>
            </button>
            <p className="mt-3 text-xs text-ink-200/55">
              Early-access pricing. Email below — we&apos;ll reach out
              personally when Premium opens.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function BranchRow({
  branch,
}: {
  branch: { trigger: string; outcome: string };
}) {
  return (
    <div className="flex items-start gap-2 text-sm leading-relaxed">
      <span className="mt-0.5 select-none text-ink-200/50">↳</span>
      <div>
        <span className="text-ink-200/70">If {branch.trigger}:</span>{" "}
        <span>{branch.outcome}</span>
      </div>
    </div>
  );
}

/* ─── Per-rec scenario expansion (Premium, lazy-loaded) ─────────── */

interface ScenarioExpansionData {
  recTitle: string;
  threeMonth: string;
  twelveMonth: string;
  fiveYear: string;
  risks: string[];
  tradeoff: string;
}

function RecScenarioExpansion({
  rec,
  index,
  profile,
}: {
  rec: Recommendation;
  index: number;
  profile: ProfileSnapshot | null;
}) {
  const unlocked = usePremiumUnlocked();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ScenarioExpansionData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "err">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Streaming view passes profile=null — don't render the lock there.
  // The user is still seeing partials; the full ResultView (which has
  // profile + the CTA target) will mount once streaming completes.
  if (!profile) return null;

  function onClick() {
    track("scenario_lock_clicked", {
      recIndex: index,
      leverage: rec.leverage,
    });
    if (!unlocked) {
      scrollToPremiumCTA();
      return;
    }
    // Toggle open. Lazy-fetch on first open only.
    setOpen((prev) => !prev);
    if (!data && status === "idle") {
      setStatus("loading");
      fetchScenario();
    }
  }

  async function fetchScenario() {
    if (!profile) {
      setStatus("err");
      setErrMsg("Missing profile snapshot.");
      return;
    }
    try {
      const res = await fetch("/api/scenario-expansion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rec: {
            title: rec.title,
            rationale: rec.rationale,
            leverage: rec.leverage,
            pathEvidence: rec.pathEvidence,
            twelveMonthOutcome: rec.twelveMonthOutcome,
          },
          profile: {
            stage: profile.stage,
            field: profile.field,
            futureSelf: profile.futureSelf,
            dilemma: profile.dilemma,
            locale: profile.locale ?? "en",
          },
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errBody.message ?? `API ${res.status}`);
      }
      const json = (await res.json()) as { scenario: ScenarioExpansionData };
      setData(json.scenario);
      setStatus("ready");
      track("scenario_loaded", { recIndex: index });
    } catch (err) {
      console.error("RecScenarioExpansion fetch error:", err);
      setErrMsg(
        err instanceof Error ? err.message : "Couldn't load scenario.",
      );
      setStatus("err");
    }
  }

  // Locked: full-width card with clearer CTA
  if (!unlocked) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mt-5 flex w-full items-center justify-between gap-3 rounded-lg border border-purple-400/40 bg-gradient-to-r from-purple-500/[0.07] to-fuchsia-500/[0.05] px-4 py-3 text-left transition hover:from-purple-500/[0.12] hover:to-fuchsia-500/[0.10]"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold leading-snug">
            🔒 What happens if I take this?
          </span>
          <span className="text-xs text-ink-200/65">
            3-month / 12-month / 5-year scenarios + risks + tradeoff
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white">
          Premium →
        </span>
      </button>
    );
  }

  // Unlocked: collapsible expand
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-md border border-ink-200/30 px-3 py-1.5 text-xs transition hover:border-ink-200/60"
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>What happens if I take this?</span>
      </button>

      {open && (
        <div className="mt-3 rounded-md border border-ink-200/15 bg-ink-200/[0.02] p-4">
          {status === "loading" && (
            <p className="text-xs italic text-ink-200/60">
              Loading scenario expansion…
            </p>
          )}
          {status === "err" && (
            <p className="text-xs text-red-400">
              {errMsg ?? "Failed to load."}
            </p>
          )}
          {status === "ready" && data && (
            <div className="flex flex-col gap-3 text-sm leading-relaxed">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/60">
                  3 months in
                </div>
                <p className="mt-1">{data.threeMonth}</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/60">
                  12 months in
                </div>
                <p className="mt-1">{data.twelveMonth}</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/60">
                  5 years in
                </div>
                <p className="mt-1">{data.fiveYear}</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
                  Risks
                </div>
                <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-ink-200/40">
                  {data.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300/80">
                  Tradeoff
                </div>
                <p className="mt-1">{data.tradeoff}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Follow-up Q&A box — structured refinement via 3 closed questions
 *
 * Renders 3 model-generated questions (loaded from /api/follow-up-questions)
 * with 3-4 click-to-pick options each, plus an "Other" free-text fallback.
 * The user's selections are concatenated into an additionalContext string
 * and pushed through the existing refine pipeline (same shape FillTheGapsBox
 * uses), so the regeneration code path is unchanged.
 *
 * UX choices:
 * - Auto-fetch on mount. The user just finished reading the plan; they're
 *   here, the latency is hidden behind their reading time.
 * - 3 questions exactly. More feels like a survey, fewer doesn't fill
 *   enough gaps.
 * - "Other" is always available, even if the model's options seem
 *   exhaustive — the model often misses edge cases (chronic illness,
 *   visa status, family obligations).
 * - Skip-friendly: the FillTheGapsBox below remains, so users who
 *   prefer free-text aren't forced through this.
 * ─────────────────────────────────────────────────────────────────── */

interface FollowUpQuestion {
  question: string;
  options: string[];
  rationale: string;
}

function FollowUpQuestionsBox({
  whatWeDontKnow,
  recommendationTitles,
  onRefine,
}: {
  whatWeDontKnow: string;
  recommendationTitles: string[];
  onRefine: (additional: string) => void;
}) {
  const [questions, setQuestions] = useState<FollowUpQuestion[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "err">("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Per-question state: selected option index OR "other"; otherText.
  // Indexed by question position. Both arrays grow with the questions
  // length once they arrive.
  const [picked, setPicked] = useState<(number | "other" | null)[]>([]);
  const [otherTexts, setOtherTexts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchQuestions() {
      try {
        const res = await fetch("/api/follow-up-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whatWeDontKnow,
            recommendationTitles,
          }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(errBody.message ?? `API ${res.status}`);
        }
        const data = (await res.json()) as { questions: FollowUpQuestion[] };
        if (cancelled) return;
        setQuestions(data.questions);
        setPicked(new Array(data.questions.length).fill(null));
        setOtherTexts(new Array(data.questions.length).fill(""));
        setStatus("ready");
        track("followup_questions_loaded", { count: data.questions.length });
      } catch (err) {
        if (cancelled) return;
        console.error("FollowUpQuestionsBox fetch error:", err);
        setErrMsg(
          err instanceof Error ? err.message : "Couldn't load questions.",
        );
        setStatus("err");
      }
    }
    fetchQuestions();
    return () => {
      cancelled = true;
    };
    // We don't include whatWeDontKnow / recommendationTitles in deps —
    // they're set once at result render and shouldn't trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickOption(qIdx: number, choice: number | "other") {
    setPicked((prev) => {
      const next = [...prev];
      next[qIdx] = choice;
      return next;
    });
  }

  function setOtherText(qIdx: number, val: string) {
    setOtherTexts((prev) => {
      const next = [...prev];
      next[qIdx] = val;
      return next;
    });
  }

  // Build the additionalContext string the recommend endpoint will see.
  // Format: "Q: ...\nA: ..." pairs separated by blank lines. Skips
  // unanswered questions silently.
  function buildAdditionalContext(): string {
    if (!questions) return "";
    const blocks: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q) continue;
      const choice = picked[i];
      let answer: string | null = null;
      if (typeof choice === "number") {
        const opt = q.options[choice];
        if (opt) answer = opt;
      } else if (choice === "other") {
        const t = (otherTexts[i] ?? "").trim();
        if (t.length > 0) answer = t;
      }
      if (answer) {
        blocks.push(`Q: ${q.question}\nA: ${answer}`);
      }
    }
    return blocks.join("\n\n");
  }

  const answeredCount = picked.filter((p, i) => {
    if (p === null) return false;
    if (p === "other") return (otherTexts[i] ?? "").trim().length >= 2;
    return true;
  }).length;
  const ready = answeredCount >= 1; // at least one answer to bother regenerating

  function submit() {
    const ctx = buildAdditionalContext();
    if (!ctx) return;
    track("followup_questions_submitted", {
      answeredCount,
      totalQuestions: questions?.length ?? 0,
    });
    onRefine(ctx);
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-ink-200/20 bg-ink-200/[0.02] p-5">
        <h3 className="text-base font-semibold leading-tight">
          A few quick questions to sharpen this
        </h3>
        <p className="mt-2 text-sm text-ink-200/70">
          Loading 3 quick questions based on what we don&apos;t know about you…
        </p>
      </div>
    );
  }

  if (status === "err" || !questions) {
    // Graceful degrade: keep the free-text refine box below, hide this
    // one. Surface a tiny note so power users can report it.
    return (
      <div className="rounded-lg border border-ink-200/20 bg-ink-200/[0.02] p-3 text-xs text-ink-200/50">
        Couldn&apos;t load the quick Q&amp;A
        {errMsg ? `: ${errMsg}` : ""}. Use the refine box below instead.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sky-400/30 bg-sky-400/[0.04] p-5">
      <h3 className="text-base font-semibold leading-tight">
        A few quick questions to sharpen this
      </h3>
      <p className="mt-2 text-sm text-ink-200/70">
        Pick an option for each — or type your own. Then we&apos;ll regenerate
        the plan with your answers as authoritative new context.
      </p>

      <div className="mt-5 flex flex-col gap-5">
        {questions.map((q, qIdx) => {
          const choice = picked[qIdx];
          return (
            <div
              key={qIdx}
              className="rounded-md border border-ink-200/15 bg-ink-200/[0.03] p-4"
            >
              <p className="text-sm font-medium">
                <span className="mr-2 text-ink-200/50">Q{qIdx + 1}.</span>
                {q.question}
              </p>
              <p className="mt-1 text-xs italic text-ink-200/55">
                {q.rationale}
              </p>

              <div className="mt-3 flex flex-col gap-2">
                {q.options.map((opt, oIdx) => {
                  const isPicked = choice === oIdx;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => pickOption(qIdx, oIdx)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                        isPicked
                          ? "border-ink-50 bg-ink-50 text-ink-950"
                          : "border-ink-200/30 bg-transparent hover:border-ink-200/60"
                      }`}
                    >
                      <span className="mr-2 text-xs font-mono opacity-60">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      {opt}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => pickOption(qIdx, "other")}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                    choice === "other"
                      ? "border-ink-50 bg-ink-50/10"
                      : "border-dashed border-ink-200/30 hover:border-ink-200/60"
                  }`}
                >
                  <span className="mr-2 text-xs font-mono opacity-60">+</span>
                  Other (write below)
                </button>

                {choice === "other" && (
                  <input
                    type="text"
                    autoFocus
                    value={otherTexts[qIdx] ?? ""}
                    onChange={(e) => setOtherText(qIdx, e.target.value)}
                    placeholder="Your answer…"
                    maxLength={280}
                    className="form-input mt-1 text-sm"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-ink-200/50">
          {answeredCount} of {questions.length} answered
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="rounded-full bg-ink-50 px-5 py-2 text-sm font-medium text-ink-950 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Refine with my answers →
        </button>
      </div>
    </div>
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
  const [willingToPay, setWillingToPay] = useState<string>(""); // €/month, raw input
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // If the user has already signaled Premium (this device or any device
  // they've signed in on), don't ask them again. The check-ins flow
  // remains available; just the Premium upsell goes away.
  const alreadyPremium = usePremiumUnlocked();
  const { data: session } = useSession();
  // Pre-fill email when authenticated — saves typing for returning users.
  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrMsg(null);

    // willingToPay is only sent when the Premium checkbox is ticked AND
    // the user typed a number. Empty + ticked = "interested but won't
    // commit to a price" — still a useful signal, captured via
    // mostInterestedIn=premium alone.
    const willingNum = willingToPay.trim() ? Number(willingToPay) : undefined;
    const willingToPayEur =
      wantsPremium &&
      typeof willingNum === "number" &&
      Number.isFinite(willingNum) &&
      willingNum >= 0 &&
      willingNum <= 1000
        ? Math.round(willingNum)
        : undefined;

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          mostInterestedIn: wantsPremium ? "premium" : "accountability",
          source: wantsPremium ? "premium_post_result" : "post_result",
          willingToPayEur,
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
      if (wantsPremium) {
        // Submitting with the Premium box ticked unlocks decision tree +
        // scenario expansion for the current device. Until Stripe ships,
        // this is the gating signal — premium intent → unlock.
        writePremiumUnlocked(true);
        // Notify same-tab listeners (DecisionTreeBox, RecScenarioExpansion)
        // — localStorage events only fire across tabs, so we use a custom
        // event for the in-page reactivity.
        window.dispatchEvent(new Event("step:premium:unlocked"));
        track("premium_intent", {
          willingToPayEur: willingToPayEur ?? null,
        });
        track("premium_unlocked", {
          willingToPayEur: willingToPayEur ?? null,
        });
      }
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
    <section
      id="post-result-cta"
      className="rounded-xl border border-ink-200/30 bg-ink-200/[0.04] p-6 dark:bg-ink-50/[0.03]"
    >
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

        {/* Premium upsell — hidden when the user has already signaled
            Premium intent on this device or any device they've signed
            in on (server-side check via /api/me/premium-status). */}
        {!alreadyPremium && (
          <>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={wantsPremium}
                onChange={(e) => {
                  setWantsPremium(e.target.checked);
                  if (!e.target.checked) setWillingToPay("");
                }}
                className="mt-1"
              />
              <span>
                <span className="font-medium">
                  I&apos;m interested in Premium.
                </span>{" "}
                <span className="text-ink-200/70 dark:text-ink-200/60">
                  Personalized monthly 1:1 with a senior advisor, CV review
                  tied to your plan, and matched job opportunities. Early
                  access pricing when it opens.
                </span>
              </span>
            </label>

            {wantsPremium && (
              <label className="ml-6 flex flex-col gap-1.5 rounded-md border border-ink-200/20 bg-ink-200/[0.03] p-3">
                <span className="text-xs uppercase tracking-wider text-ink-200/60">
                  What would you pay per month? (optional)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-200/60">€</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000}
                    value={willingToPay}
                    onChange={(e) => setWillingToPay(e.target.value)}
                    placeholder="e.g. 15"
                    className="form-input flex-1"
                    disabled={status === "sending"}
                  />
                  <span className="text-xs text-ink-200/50">/ month</span>
                </div>
                <span className="text-xs text-ink-200/50">
                  Honest answer beats a polite zero. We use this to size the
                  early-access pricing.
                </span>
              </label>
            )}
          </>
        )}

        {alreadyPremium && (
          <p className="text-xs text-ink-200/55">
            ✓ You&apos;re on the Premium early-access list — we&apos;ll
            reach out personally when it opens.
          </p>
        )}

        {errMsg && (
          <p className="text-xs text-red-500 dark:text-red-400">{errMsg}</p>
        )}
      </form>
    </section>
  );
}

function LeverageBadge({ level }: { level: Leverage | undefined }) {
  // Defensive: if the value is missing or unknown (e.g. an older cached
  // result without the field, or model output drift), render nothing
  // instead of crashing on a config[undefined] lookup.
  const configs: Record<
    Leverage,
    { label: string; className: string; hint: string }
  > = {
    foundation: {
      label: "Foundation",
      className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      hint: "Without this, the 5-year vision is unrealistic.",
    },
    accelerator: {
      label: "Accelerator",
      className: "border-sky-400/40 bg-sky-400/10 text-sky-300",
      hint: "Compresses the timeframe — the path can work without it.",
    },
    optional: {
      label: "Optional",
      className: "border-ink-200/30 bg-ink-200/5 text-ink-200/70",
      hint: "Useful, low-risk, but not gating.",
    },
  };
  const config = level ? configs[level] : undefined;
  if (!config) return null;
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.className}`}
      title={config.hint}
    >
      {config.label}
    </span>
  );
}

function RecommendationCard({
  rec,
  index,
  profile,
}: {
  rec: Recommendation;
  index: number;
  profile: ProfileSnapshot | null;
}) {
  const confidenceColor =
    rec.confidence.level === "high"
      ? "text-green-600 dark:text-green-400"
      : rec.confidence.level === "medium"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <article className="rounded-2xl border border-ink-200/15 bg-gradient-to-b from-amber-400/[0.02] to-transparent p-6 md:p-7">
      {/* Header: big accent number + title + leverage. Rationale follows
          directly under the title so the card reads top-down without a
          "what is this paragraph for?" moment. */}
      <header className="flex flex-wrap items-start gap-4 border-b border-ink-200/10 pb-5 md:flex-nowrap">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-base font-semibold text-amber-300 ring-1 ring-amber-400/30"
          aria-hidden
        >
          {index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-xl font-semibold leading-tight md:text-[1.55rem]">
              {rec.title}
            </h3>
            <LeverageBadge level={rec.leverage} />
          </div>
          <p className="mt-2.5 text-[15px] leading-relaxed text-ink-200/85">
            {rec.rationale}
          </p>
        </div>
      </header>

      {/* Evidence — accent-tinted to anchor "this is grounded in real
          retrieved paths, not invented." */}
      {rec.pathEvidence && (
        <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/85">
            Evidence from retrieved paths
          </div>
          <p className="mt-1.5 leading-relaxed text-ink-200/90">
            {rec.pathEvidence}
          </p>
        </div>
      )}

      {/* Two-column grid: 90-day actions take the wider left column;
          outcome + pattern stack on the right. Collapses to a single
          column on mobile so nothing gets squished. */}
      <div className="mt-6 grid gap-5 md:grid-cols-[1.45fr_1fr]">
        <section className="rounded-lg border border-ink-200/10 bg-ink-200/[0.02] p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/65">
            90-day actions
          </h4>
          <ol className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
            {rec.ninetyDayActions.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-amber-400/5 text-[10px] font-semibold text-amber-300/90"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="text-ink-200/90">{a}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-ink-200/10 bg-ink-200/[0.02] p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/65">
              12-month outcome
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-ink-200/90">
              {rec.twelveMonthOutcome}
            </p>
          </section>
          <section className="rounded-lg border border-ink-200/10 bg-ink-200/[0.02] p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-200/65">
              Similar pattern
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-ink-200/90">
              {rec.similarProfilePattern}
            </p>
          </section>
        </div>
      </div>

      {/* Footer — confidence first, then the paths the model cited. Both
          live below a soft divider so they read as "metadata" not as
          part of the recommendation itself. */}
      <footer className="mt-6 flex flex-col gap-2.5 border-t border-ink-200/10 pt-4 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ink-200/65">
          <span className={`font-semibold ${confidenceColor}`}>
            {rec.confidence.level.toUpperCase()} confidence
          </span>
          <span className="text-ink-200/35">·</span>
          <span className="leading-relaxed">{rec.confidence.reason}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-ink-200/55">
          <span className="text-ink-200/40">Based on:</span>
          {rec.basedOnPathIds.map((id) => (
            <code
              key={id}
              className="rounded bg-ink-200/10 px-1.5 py-0.5 text-[11px]"
            >
              {id}
            </code>
          ))}
        </div>
      </footer>

      <FeedbackWidget rec={rec} index={index} />

      <RecScenarioExpansion rec={rec} index={index} profile={profile} />
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
  onRetry,
  onReset,
}: {
  message: string;
  // Retry with the SAME profile state. ~95% success rate because Haiku
  // schema-flake is non-deterministic and a fresh run usually behaves.
  onRetry: () => void;
  // Nuke result + persistence and go back to intro (the old behaviour).
  onReset: () => void;
}) {
  // Schema-flake is the most common cause we see; tell the user it's
  // usually transient. Hard timeouts still get the secondary hint.
  const isSchemaFlake =
    /didn'?t match schema|schema|validation/i.test(message);
  const isTimeout = /timeout|too long|cap/i.test(message);

  return (
    <section className="my-auto flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="max-w-md text-sm text-ink-200/70">{message}</p>
      {isSchemaFlake && !isTimeout && (
        <p className="max-w-md text-xs text-ink-200/50">
          The model occasionally produces an output we can&apos;t parse.
          A fresh retry almost always works — your form data is kept.
        </p>
      )}
      {isTimeout && (
        <p className="max-w-md text-xs text-ink-200/50">
          Heads-up: if the LLM call exceeds Vercel&apos;s function cap, we time
          out. Try again — most queries fit. If it persists, simplify your
          past positions or futureSelf.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onRetry}
          type="button"
          className="rounded-full bg-ink-50 px-6 py-2.5 text-sm font-medium text-ink-950 hover:opacity-80"
        >
          Try again
        </button>
        <button
          onClick={onReset}
          type="button"
          className="rounded-full border border-ink-200/30 px-5 py-2 text-sm transition hover:border-ink-200/60"
        >
          Start over
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16 flex flex-col gap-4 text-xs text-ink-200/50 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span>© {new Date().getFullYear()} Step</span>
        <Link
          href="/how-it-works"
          className="underline-offset-4 transition hover:underline hover:text-ink-200/80"
        >
          How it works
        </Link>
        <Link
          href="/about"
          className="underline-offset-4 transition hover:underline hover:text-ink-200/80"
        >
          About
        </Link>
      </div>
      <span>Built with care in Italy &amp; the UK.</span>
    </footer>
  );
}
