/**
 * Per-day allowed answers for 1-click check-in replies.
 *
 * Each day's email shows 3-4 buttons. Each button posts back a
 * structured `answer` key (snake_case). The reply endpoint validates
 * the incoming pair against this map — anything else gets 400.
 *
 * Labels are what shows on the button. Keep them short (≤22 chars) so
 * mobile email clients don't wrap awkwardly.
 */
import type { CheckinDay } from "./schedule";

export type AnswerOption = {
  key: string;
  label: string;
};

export const CHECKIN_ANSWERS: Record<CheckinDay, AnswerOption[]> = {
  1: [
    { key: "started", label: "I started" },
    { key: "not_yet", label: "Not yet" },
    { key: "need_help", label: "Need help" },
  ],
  3: [
    { key: "on_track", label: "On track" },
    { key: "time_issue", label: "Time issue" },
    { key: "stuck", label: "Stuck on an action" },
    { key: "rethinking", label: "Rethinking the plan" },
  ],
  7: [
    { key: "easier", label: "Easier than expected" },
    { key: "as_expected", label: "About as expected" },
    { key: "harder", label: "Harder than expected" },
    { key: "different", label: "Going in a different direction" },
  ],
  14: [
    { key: "still_on_it", label: "Still on it" },
    { key: "need_to_adjust", label: "Need to adjust" },
    { key: "want_fresh_plan", label: "Want a fresh plan" },
  ],
  30: [
    { key: "external_proof", label: "Yes — something shipped" },
    { key: "partial", label: "Partial — still working" },
    { key: "nothing_yet", label: "Nothing yet" },
  ],
  60: [
    { key: "shipped_with_convos", label: "Shipped + having conversations" },
    { key: "shipped_no_convos", label: "Shipped, no conversations" },
    { key: "still_not_shipped", label: "Still not shipped" },
  ],
  90: [
    { key: "foundation_worked", label: "Foundation worked — refresh" },
    { key: "foundation_off", label: "Foundation off — fresh plan" },
    { key: "still_in_progress", label: "Still in progress" },
  ],
  180: [
    { key: "on_track_for_12mo", label: "On track for 12-month" },
    { key: "missed_12mo", label: "Already missed" },
    { key: "revised_target", label: "Target revised" },
  ],
  365: [
    { key: "hit_target", label: "Hit the 12-month target" },
    { key: "missed_target", label: "Missed it" },
    { key: "different_outcome", label: "Landed somewhere else" },
  ],
};

export function isValidAnswer(day: CheckinDay, key: string): boolean {
  return CHECKIN_ANSWERS[day].some((a) => a.key === key);
}
