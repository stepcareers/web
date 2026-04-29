"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Step beta — the actual recommendation pipeline (form → API → result).
 *
 * Lives at /beta. Marketing landing at / talks about the product;
 * users who want to try the working pipeline come here.
 */

type Stage =
  | "university_student"
  | "recent_grad"
  | "0_3y"
  | "3_7y"
  | "7_plus";

type Field =
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

type Locale = "en" | "it";

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

const STAGE_OPTIONS: Array<{ value: Stage; label: string }> = [
  { value: "university_student", label: "University student" },
  { value: "recent_grad", label: "Recent graduate" },
  { value: "0_3y", label: "0–3 years experience" },
  { value: "3_7y", label: "3–7 years experience" },
  { value: "7_plus", label: "7+ years experience" },
];

const FIELD_OPTIONS: Array<{ value: Field; label: string }> = [
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
  "Italian business culture",
  "English business writing",
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

const LOADING_MESSAGES = [
  "Reading your profile…",
  "Searching curated career paths…",
  "Finding similar profiles…",
  "Drafting your options…",
  "Sharpening the honest take…",
  "Almost there — stitching it together…",
];

const MAX_SKILLS = 8;
const MAX_INTERESTS = 5;

export default function BetaPage() {
  const [phase, setPhase] = useState<"form" | "loading" | "result" | "error">(
    "form",
  );
  const [stage, setStage] = useState<Stage>("0_3y");
  const [field, setField] = useState<Field>("computer_science");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [dilemma, setDilemma] = useState("");
  const [locale] = useState<Locale>("en");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
      setElapsedSec((s) => s + 5);
    }, 5000);
    return () => clearInterval(t);
  }, [phase]);

  function toggleSkill(s: string) {
    setErrorMsg(null);
    setSkills((current) => {
      if (current.includes(s)) return current.filter((x) => x !== s);
      if (current.length >= MAX_SKILLS) {
        setErrorMsg(`Max ${MAX_SKILLS} skills. Remove one to add another.`);
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
        setErrorMsg(`Max ${MAX_INTERESTS} interests. Remove one to add another.`);
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
      setErrorMsg(`Max ${MAX_SKILLS} skills. Remove one to add another.`);
      return;
    }
    setSkills((s) => [...s, v]);
    setSkillInput("");
    setErrorMsg(null);
  }

  function addCustomInterest() {
    const v = interestInput.trim();
    if (!v) return;
    if (interests.includes(v)) {
      setInterestInput("");
      return;
    }
    if (interests.length >= MAX_INTERESTS) {
      setErrorMsg(`Max ${MAX_INTERESTS} interests. Remove one to add another.`);
      return;
    }
    setInterests((s) => [...s, v]);
    setInterestInput("");
    setErrorMsg(null);
  }

  const isValid = skills.length >= 1 && interests.length >= 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (skills.length === 0) {
      setErrorMsg("Pick at least 1 skill (or add a custom one).");
      return;
    }
    if (interests.length === 0) {
      setErrorMsg("Pick at least 1 interest (or add a custom one).");
      return;
    }

    setPhase("loading");
    setLoadingMsgIdx(0);
    setElapsedSec(0);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          field,
          skills,
          interests,
          dilemma: dilemma.trim() || undefined,
          locale,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(errBody.message ?? errBody.error ?? `API ${res.status}`);
      }

      const data = (await res.json()) as ApiResponse;
      setResult(data);
      setPhase("result");
    } catch (err) {
      console.error("Submit error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }

  function handleReset() {
    setPhase("form");
    setResult(null);
    setErrorMsg(null);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 md:py-14">
      <header className="mb-10 flex items-center justify-between">
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
        <FormView
          stage={stage}
          setStage={setStage}
          field={field}
          setField={setField}
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
          dilemma={dilemma}
          setDilemma={setDilemma}
          errorMsg={errorMsg}
          isValid={isValid}
          onSubmit={handleSubmit}
        />
      )}

      {phase === "loading" && (
        <LoadingView
          message={LOADING_MESSAGES[loadingMsgIdx] ?? "…"}
          elapsedSec={elapsedSec}
        />
      )}

      {phase === "result" && result && (
        <ResultView data={result} onReset={handleReset} />
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

/* ─── Form view ──────────────────────────────────────────────────── */

interface FormProps {
  stage: Stage;
  setStage: (s: Stage) => void;
  field: Field;
  setField: (f: Field) => void;
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
  dilemma: string;
  setDilemma: (s: string) => void;
  errorMsg: string | null;
  isValid: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

function FormView(p: FormProps) {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Tell us where you are.
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-200/90 dark:text-ink-200/70">
          Two minutes. We&apos;ll give you 3–5 ranked next moves with
          concrete 90-day actions, grounded in real career patterns.
        </p>
      </div>

      {p.errorMsg && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {p.errorMsg}
        </div>
      )}

      <form onSubmit={p.onSubmit} className="flex flex-col gap-7">
        <Field label="Where are you in your career?">
          <select
            value={p.stage}
            onChange={(e) => p.setStage(e.target.value as Stage)}
            className="w-full rounded-md border border-ink-200/40 bg-white px-3 py-2.5 text-base text-ink-950 focus:border-accent focus:outline-none"
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What's your field?">
          <select
            value={p.field}
            onChange={(e) => p.setField(e.target.value as Field)}
            className="w-full rounded-md border border-ink-200/40 bg-white px-3 py-2.5 text-base text-ink-950 focus:border-accent focus:outline-none"
          >
            {FIELD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <ChipPicker
          label="What skills do you have today?"
          hint={`Pick up to ${MAX_SKILLS}. Click to select. Add your own if missing.`}
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
          hint={`Pick up to ${MAX_INTERESTS}. Click to select. Add your own if missing.`}
          counterText={`${p.interests.length}/${MAX_INTERESTS}`}
          suggestions={INTEREST_SUGGESTIONS}
          selected={p.interests}
          onToggle={p.toggleInterest}
          inputValue={p.interestInput}
          onInputChange={p.setInterestInput}
          onAddCustom={p.addCustomInterest}
          customPlaceholder="Add another interest…"
        />

        <Field
          label="What's the decision on your mind? (optional)"
          hint="Be specific. The clearer the dilemma, the better the recommendation."
        >
          <textarea
            value={p.dilemma}
            onChange={(e) => p.setDilemma(e.target.value)}
            placeholder="e.g. Junior backend engineer at a Series B fintech, 18 months in. I want to be tech lead in 18-24 months — what do I actually do?"
            rows={4}
            maxLength={500}
            className="w-full rounded-md border border-ink-200/40 bg-white px-3 py-2.5 text-base text-ink-950 focus:border-accent focus:outline-none"
          />
          <span className="self-end text-xs text-ink-200/50">
            {p.dilemma.length}/500
          </span>
        </Field>

        <button
          type="submit"
          disabled={!p.isValid}
          className="self-start rounded-full bg-ink-950 px-7 py-3 text-sm font-medium text-ink-50 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-ink-50 dark:text-ink-950"
        >
          Get my next steps
        </button>
        {!p.isValid && (
          <span className="-mt-4 text-xs text-ink-200/60">
            Pick at least 1 skill and 1 interest to continue.
          </span>
        )}
      </form>
    </section>
  );
}

/* ─── Chip picker ─────────────────────────────────────────────────── */

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
                  ? "border-ink-950 bg-ink-950 text-ink-50 dark:border-ink-50 dark:bg-ink-50 dark:text-ink-950"
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
          className="flex-1 rounded-md border border-ink-200/40 bg-white px-3 py-2 text-sm text-ink-950 focus:border-accent focus:outline-none"
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

function Field({
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
        className="h-10 w-10 animate-spin rounded-full border-2 border-ink-200/30 border-t-ink-950 dark:border-t-ink-50"
        aria-label="Loading"
      />
      <p className="text-lg">{message}</p>
      <p className="text-sm text-ink-200/60 dark:text-ink-200/50">
        This takes ~60–90 seconds. We&apos;re calling Claude under the hood, no shortcuts.
        {elapsedSec > 0 && ` (${elapsedSec}s elapsed)`}
      </p>
    </section>
  );
}

function ResultView({
  data,
  onReset,
}: {
  data: ApiResponse;
  onReset: () => void;
}) {
  const { result, meta } = data;
  return (
    <section className="flex flex-col gap-10">
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
    </article>
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
          Heads-up: the beta&apos;s LLM call sometimes exceeds Vercel&apos;s 60s cap.
          We&apos;re fixing this. Meanwhile, refresh and try again — it works for
          most queries.
        </p>
      )}
      <button
        onClick={onReset}
        type="button"
        className="rounded-full bg-ink-950 px-5 py-2 text-sm font-medium text-ink-50 hover:opacity-80 dark:bg-ink-50 dark:text-ink-950"
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
