# Prisma — Step database

The schema is in `schema.prisma`. Migrations live in `prisma/migrations/`.

## First-time setup (you run this once locally)

You need the **Supabase Postgres connection strings**. Get them from:

1. https://supabase.com/dashboard/project/txolhsutozawdrxfobfm/settings/database
2. Section **"Connection String"** → choose **"Connection pooling"** → **Mode: Transaction**
   - Copy this URL — it's your `DATABASE_URL` (used by the app at runtime).
   - The URL contains your DB password (the one you saved in your password manager when the project was created).
3. Same page, scroll to **"Direct connection"** (or toggle "Connection pooling" off)
   - Copy this URL — it's your `DIRECT_URL` (used by Prisma migrations only).

Add both to `web/.env` (NOT `.env.local`):

```
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres"
```

**Why `.env` and not `.env.local`?** Prisma CLI only reads `.env` by default. Next.js reads both, with `.env.local` taking priority for app runtime, so DB URLs in `.env` work for both Prisma migrations and the Next.js app. Both files are in `.gitignore` so secrets never leak.

If you already pasted the URLs into `.env.local`, just copy the file:

```bash
cp .env.local .env       # macOS/Linux
copy .env.local .env     # Windows PowerShell
```

Then create and apply the initial migration:

```bash
npm install                       # picks up Prisma + tsx
npx prisma generate               # generate the typed client
npx prisma migrate dev --name init  # creates the migration files + applies them to Supabase
```

After this:
- The migration file appears under `prisma/migrations/<timestamp>_init/`.
- Tables are created on Supabase: `users`, `sessions`, `inputs`, `paths`, `path_embeddings`, `results`, `email_subscriptions`.
- The Prisma client is regenerated with all the typed accessors.

## Add the HNSW index for vector search

Prisma can't manage HNSW indexes natively (yet). After the first migration runs, edit the latest migration SQL file under `prisma/migrations/<timestamp>_init/migration.sql` and add at the very bottom:

```sql
-- Vector similarity index for fast top-k retrieval.
-- 1024 dims (voyage-3-large). m=16, ef_construction=64 are sane defaults.
CREATE INDEX path_embeddings_embedding_hnsw_idx
  ON path_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Then re-run migrations:

```bash
npx prisma migrate dev
```

## Add the env vars to Vercel

Once `DATABASE_URL` and `DIRECT_URL` work locally, add them to Vercel team Shared env vars (Sensitive ON):

- Vercel → `stepcareers21` → Settings → Environment Variables → Shared
- Add `DATABASE_URL` (Sensitive ON, all environments)
- Add `DIRECT_URL` (Sensitive ON, all environments)

The next deploy will pick them up. Until then, the build runs fine because `lib/env.ts` keeps these fields optional.

## Day-to-day commands

```bash
npm run db:generate   # regenerate the Prisma client after schema changes
npm run db:migrate    # create + apply a new migration in dev (interactive)
npm run db:deploy     # apply pending migrations in CI/prod (non-interactive)
npm run db:studio     # GUI to inspect the database (http://localhost:5555)
npm run db:format     # pretty-print schema.prisma
npm run db:seed       # load paths from dataset/seed_paths.csv into the DB
```

## Conventions

- Every schema change is a migration. Never `prisma db push` against `step-prod`.
- Snake_case in Postgres (`@@map` and `@map`), PascalCase in Prisma models.
- Enum-like fields are `String` validated with Zod app-side. To add a value, no migration needed.
- Soft-delete (`deleted_at`) is reserved for `users` and `results`. Everything else is hard-delete.
- HNSW index params (`m`, `ef_construction`, `ef_search`) get tuned once we have ~500+ paths and real query latency to measure.

## When something breaks

- "Schema drift detected" → someone applied a migration in another environment. Run `prisma migrate resolve` per the [Prisma docs](https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting).
- "Connection refused" → check that your Supabase project is not paused (free tier auto-pauses after 7 days of inactivity).
- pgvector errors → confirm the extension is enabled in Supabase: Database → Extensions → `vector` toggle should be ON. (We enabled it Day 1.)
