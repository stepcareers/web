-- Manual migration — run this once on Supabase SQL editor.
--
-- Adds a "willing_to_pay_eur" column to the existing waitlist table so we
-- can capture the user's price expectation when they tick "I'm interested
-- in Premium" on the post-result CTA.
--
-- The column is nullable because:
--   1. Existing rows won't have it.
--   2. Users who tick the Premium checkbox without entering a number still
--      signal intent — we don't want to lose that signal.
--
-- Constraint: must be 0 or positive. Cap at 1000 €/month — anything
-- higher is almost certainly a typo we don't want polluting the data.

ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS willing_to_pay_eur INTEGER
  CHECK (willing_to_pay_eur IS NULL OR (willing_to_pay_eur >= 0 AND willing_to_pay_eur <= 1000));

-- Optional: a short index so we can quickly query "users willing to pay
-- > €X" when sizing the premium tier later.
CREATE INDEX IF NOT EXISTS waitlist_willing_to_pay_eur_idx
  ON waitlist (willing_to_pay_eur)
  WHERE willing_to_pay_eur IS NOT NULL;
