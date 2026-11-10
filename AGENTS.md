# AGENTS.md

## Project context

DealOS is an experience-driven sales intelligence agent. It remembers sales interactions, understands customer context, and uses accumulated experience to recommend better sales actions.

**Current phase:** Hackathon-ready build with all three memory layers implemented: deal memory, personal learning, and organizational intelligence, plus adaptive recommendations.

## Where to find the specs and submission material

- `docs/PHASE1_SPEC.md` — original infrastructure requirements.
- `docs/HACKATHON_SUBMISSION.md` — submission copy, differentiators, judging notes.
- `docs/VIDEO_SCRIPT.md` — 3-minute recording script and shot list.
- `docs/DEMO_RUNBOOK.md` — pre-flight, demo data, fallbacks.
- `README.md` — current product overview, architecture, setup, verification.

## Key facts

- Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, PostgreSQL 17 (Docker Compose), Prisma 6, OpenRouter (NVIDIA Nemotron 3 Super), Walrus Memory Mainnet, Tatum Sui Mainnet RPC, Zod. (shadcn CLI init was skipped; components follow shadcn-style conventions with a shared `cn()` util.)
- Project directory: `/Users/mavens/walrus_hackathon` (repository root).
- Model: `nvidia/nemotron-3-super-120b-a12b` (configurable via env). The old `:free` slug was retired by OpenRouter and now returns 404.
- Required env vars are validated with Zod in `src/lib/env.ts`. See `.env.example`.
- Do not install: Supabase, LangChain, LangGraph, Ollama, Redis, Pinecone, separate embedding infra, Kubernetes.
- Never commit secrets. `.env*` is gitignored (`.env.example` is explicitly un-ignored). Secrets must never be exposed to frontend (no `NEXT_PUBLIC_` prefix).
- All integrations must be verified with real working code — do not claim success from configuration alone.

## Environment specifics (important)

- Use Node **22** (`nvm use`; `.nvmrc` = 22). Node 20.18 fails the Tailwind v4 build because `@tailwindcss/node` uses `require(esm)`.
- Docker Postgres is published on host port **5433** (container 5432) because a local Homebrew `postgresql@17` already owns 5432. `DATABASE_URL` targets `127.0.0.1:5433`.
- Next 16 has `cacheComponents: true`; route handlers must NOT export `runtime`/`dynamic`. They use `await connection()` from `next/server` to force dynamic rendering.
- Tailwind is wired through `@tailwindcss/postcss` + `postcss.config.mjs` (the `@tailwindcss/turbopack` loader is broken under Turbopack).

## Integration commands

- Start PostgreSQL: `docker compose up -d`
- Prisma: `npx prisma generate`, `npx prisma migrate dev --name init`
- Run dev server: `npm run dev`
- Health summary: `npm run health` (add `--write` for mutating DB + Walrus tests)
- Persistence check: `npm run db:roundtrip`; restart test uses `db:persist:insert` / `db:persist:verify`
- Infrastructure dashboard: `/infrastructure`
- Demo pre-flight: `npm run demo:preflight`
- Walrus Mainnet inspector: `npm run memory:inspect -- <dealId> "query"`
- Full test suite: `npm test`; real integration: `npm run test:integration`; end-to-end deal workflow: `npm run test:phase2`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
