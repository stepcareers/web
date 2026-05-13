-- Manual migration — run once on Supabase SQL editor.
--
-- Adds the columns the Premium check-in cron needs:
--   - users.checkins_unsubscribed_at  — opt-out flag, NULL = subscribed
--   - plans.last_checkin_day          — highest checkin day already sent
--
-- Idempotent via IF NOT EXISTS.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS checkins_unsubscribed_at TIMESTAMPTZ;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS last_checkin_day INTEGER NOT NULL DEFAULT 0;
