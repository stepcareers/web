-- Manual migration — run this once on Supabase SQL editor.
--
-- Adds Stripe customer pointer + Premium expiry to users table.
-- Idempotent via IF NOT EXISTS guards.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS premium_until      TIMESTAMPTZ;

-- One Stripe customer = one user. Lets us look up the user from a webhook
-- payload by stripe customer id without joining through subscriptions.
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_key
  ON users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
