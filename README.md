# Step — `web`

The Next.js web app for **Step** (`step.careers`) — a career decision platform that gives young professionals 3–5 ranked next moves backed by real career patterns.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript strict**
- **Tailwind CSS 3.4** for styling (shadcn/ui to be added Day 2)
- **Zod** for env validation and runtime input checking
- **Supabase** (Postgres + Auth + pgvector) — region `eu-west-1` (Ireland)
- **Anthropic Claude** for the recommendation reasoning
- **Langfuse** (EU) for LLM tracing
- **Resend** for transactional email
- Deployed on **Vercel** (team `stepcareers21`, Hobby plan)

## First time setup

You need **Node.js ≥ 20** and **pnpm**.

```bash
# from the project root (web/)
pnpm install
cp .env.local.example .env.local   # then fill in values from your password manager
pnpm dev                            # http://localhost:3000
```

Useful scripts:

```bash
pnpm typecheck   # tsc --noEmit, must pass before any PR
pnpm lint        # next lint
pnpm build       # production build (also validates env vars)
```

## Environment variables

Real values live in two places:

1. **Vercel team Shared env vars** for Production / Preview / Custom Environments. Set as Sensitive.
2. **`.env.local`** on your machine for local dev. **Never commit this file.**

A complete list of variable names is in `.env.local.example` and (with descriptions) in the project root `../.env.example`.

Validation is enforced by `lib/env.ts` — if a required var is missing or wrong-shape, the app **crashes at boot** with a clear log, not at runtime.

## Project conventions

- **TypeScript strict**, no `any`. If you need an escape hatch, use `unknown` and narrow.
- **Validation at the boundary**: every external input (form, API, webhook, env, LLM output) passes through Zod.
- **Italian in user-facing copy, English in code** (commits, comments, identifiers, docs).
- **Migration-first** for the DB: never change the Supabase schema without a Prisma migration (Day 2 onward).
- **Conventional Commits** in English: `feat(scope): subject`, `fix(scope): subject`.

## Deploy

Push to `main` → Vercel auto-deploys to production. Every PR gets its own preview URL.

## Where things live (so far)

```
web/
├── app/
│   ├── layout.tsx        # root layout, metadata, fonts
│   ├── page.tsx          # marketing homepage (single sentence MVP)
│   └── globals.css       # Tailwind base + CSS vars
├── lib/
│   └── env.ts            # Zod env validation (server + client)
├── public/               # static assets — empty for now
├── .env.local.example
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json         # strict + noUncheckedIndexedAccess
└── package.json
```

Day 2 will add: i18n (`next-intl`, en + it), shadcn/ui, Prisma + initial schema, Anthropic + Langfuse client setup.
