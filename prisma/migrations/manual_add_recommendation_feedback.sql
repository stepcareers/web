-- Manual migration — run once on Supabase SQL editor.
--
-- Adds the `plan_recommendation_feedback` table for inline 👍/👎 ratings
-- on individual recommendations inside a saved plan. One vote per
-- (user, plan, rec_index), upsert semantics in the API.

CREATE TABLE IF NOT EXISTS plan_recommendation_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id    UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rec_index  INTEGER NOT NULL,
  rec_title  TEXT NOT NULL,
  rating     TEXT NOT NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT plan_recommendation_feedback_user_plan_idx_unique
    UNIQUE (user_id, plan_id, rec_index)
);

CREATE INDEX IF NOT EXISTS plan_recommendation_feedback_plan_id_idx
  ON plan_recommendation_feedback (plan_id);
CREATE INDEX IF NOT EXISTS plan_recommendation_feedback_rating_idx
  ON plan_recommendation_feedback (rating);

-- Reuse the plans-table trigger pattern so updated_at stays fresh.
CREATE OR REPLACE FUNCTION plan_recommendation_feedback_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_recommendation_feedback_set_updated_at_trg
  ON plan_recommendation_feedback;
CREATE TRIGGER plan_recommendation_feedback_set_updated_at_trg
BEFORE UPDATE ON plan_recommendation_feedback
FOR EACH ROW
EXECUTE FUNCTION plan_recommendation_feedback_set_updated_at();
