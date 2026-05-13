-- Manual migration — run once on Supabase SQL editor.
--
-- Adds JSONB columns to capture the full RecommendInput blob:
--   - inputs.full_input        — populated on every /api/recommend call
--   - plans.input_snapshot     — denormalised snapshot on /api/me/plans POST
--
-- Both are nullable. Existing rows stay null; new rows get populated.
-- Idempotent via IF NOT EXISTS.

ALTER TABLE inputs
  ADD COLUMN IF NOT EXISTS full_input JSONB;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS input_snapshot JSONB;
