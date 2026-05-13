-- Manual migration — run once on Supabase SQL editor.
--
-- Adds `plan_checkin_responses` to store 1-click answers from check-in
-- emails. Unique on (plan_id, day) so a later click on the same email
-- overrides the earlier one (the user changed their mind).
-- Idempotent.

CREATE TABLE IF NOT EXISTS plan_checkin_responses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id    UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day        INTEGER NOT NULL,
  answer     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT plan_checkin_responses_plan_day_unique
    UNIQUE (plan_id, day)
);

CREATE INDEX IF NOT EXISTS plan_checkin_responses_user_id_idx
  ON plan_checkin_responses (user_id);
CREATE INDEX IF NOT EXISTS plan_checkin_responses_day_idx
  ON plan_checkin_responses (day);
CREATE INDEX IF NOT EXISTS plan_checkin_responses_answer_idx
  ON plan_checkin_responses (answer);

CREATE OR REPLACE FUNCTION plan_checkin_responses_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_checkin_responses_set_updated_at_trg
  ON plan_checkin_responses;
CREATE TRIGGER plan_checkin_responses_set_updated_at_trg
BEFORE UPDATE ON plan_checkin_responses
FOR EACH ROW
EXECUTE FUNCTION plan_checkin_responses_set_updated_at();

-- Plans table — transition_arc column for cohort routing (rule-based
-- classifier in app/api/me/plans POST).
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS transition_arc TEXT;

CREATE INDEX IF NOT EXISTS plans_transition_arc_idx
  ON plans (transition_arc);
