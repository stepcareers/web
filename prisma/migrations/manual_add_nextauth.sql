-- Manual migration — run this once on Supabase SQL editor.
--
-- Adds NextAuth v5 tables (accounts, verification_tokens) and extra
-- columns to the existing users table (name, email_verified, image,
-- and a default for id so NextAuth can auto-generate UUIDs).
--
-- Idempotent via IF NOT EXISTS guards.

------------------------------------------------------------
-- 1. Add NextAuth fields to users + a UUID default
------------------------------------------------------------

-- Drop the old "no default" constraint so NextAuth can insert without
-- providing an id. Existing rows keep their UUIDs unchanged.
ALTER TABLE users
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image TEXT;

------------------------------------------------------------
-- 2. accounts (one row per OAuth link, per user)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL,
  provider              TEXT NOT NULL,
  provider_account_id   TEXT NOT NULL,
  refresh_token         TEXT,
  access_token          TEXT,
  expires_at            INTEGER,
  token_type            TEXT,
  scope                 TEXT,
  id_token              TEXT,
  session_state         TEXT,
  CONSTRAINT accounts_provider_provideraccountid_key
    UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts (user_id);

------------------------------------------------------------
-- 3. verification_tokens (Resend magic-link flow)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  CONSTRAINT verification_tokens_identifier_token_key
    UNIQUE (identifier, token)
);

------------------------------------------------------------
-- Done. Verify with:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'users';
--   \dt public.accounts public.verification_tokens
------------------------------------------------------------
