# DealOS

**Experience-driven sales intelligence that remembers every deal, every lesson, and every pattern that works.**

DealOS turns raw sales calls into durable, evidence-backed memory. It remembers the customer, learns from the salesperson, and compounds validated patterns across the organization — using **Walrus Memory Mainnet** as the persistent memory layer.

> Built for the **Tatum × Walrus Memory — Total Recall** hackathon. All customer transcripts and the organizational dataset in this repository are synthetic and clearly labeled.

---

## The problem

Sales intelligence today is mostly stateless. CRM notes are stale, call summaries are forgotten, and the lessons from one deal rarely reach the next salesperson. The result is the same discovery, the same objections, and the same mistakes repeated across every deal.

## What DealOS does

DealOS implements three connected memory layers:

1. **Deal memory** — each customer, call, fact, objection, stakeholder, and commitment is retained and recallable for that specific deal.
2. **Personal learning** — sales techniques and lessons are stored separately, synced to Walrus, and retrieved when relevant.
3. **Organizational intelligence** — recurring case patterns, strategy outcomes, and approved playbooks are synthesized across synthetic multi-rep data.

Those layers feed an **adaptive recommendation** inside the Memory Explorer: a next-best action grounded in the deal's evidence, the rep's techniques, the organization's playbooks, and recalled Walrus memories.

## Live product surfaces

| Route | What it demonstrates |
|---|---|
| `/deals` | Deal list, creation, stage/status tracking, call counts |
| `/deals/[dealId]` | Transcript submission, call timeline, extracted facts, Walrus sync status, deal-scoped recall |
| `/deals/[dealId]/calls/[callId]` | Structured Nemotron analysis, evidence, suggested stage, MemorySync details |
| `/deals/[dealId]/memory` | Interactive memory graph, timeline, recommendation generation, technique links |
| `/learning` | Personal technique library, Walrus sync status, semantic recall |
| `/intelligence` | Case library, strategy explorer, playbooks, learning insights, organizational Walrus memory |
| `/infrastructure` | Live checks for PostgreSQL, OpenRouter/Nemotron, Walrus Memory, and Tatum Sui RPC |


## What is implemented

- Create and manage deals with stages and statuses.
- Submit multiple call transcripts per deal.
- Analyze transcripts with NVIDIA Nemotron via OpenRouter, validated by Zod with one correction retry.
- Persist summaries, categorized facts, evidence, severity, and suggested stages in PostgreSQL.
- Keep the salesperson in control of the deal stage; model suggestions are advisory.
- Extract and persist useful experiences with Walrus `analyzeAndWait()`.
- Track PostgreSQL persistence and Walrus persistence independently with `MemorySync`.
- Retry failed Walrus writes without marking them complete prematurely.
- Recall deal-scoped memories, and inspect all indexed memories on Mainnet.
- Build a memory graph linking facts, calls, techniques, recommendations, and timeline events.
- Add personal techniques and sync them to the learning namespace.
- Seed a synthetic organizational dataset and explore cases, strategies, playbooks, and insights.
- Generate evidence-backed recommendations that cite the memories and techniques used.

## Architecture

```text
Sales call transcript
        │
        ▼
POST /api/deals/:id/calls
        │
        ├── PostgreSQL: Call (PENDING → PROCESSING)
        │
        ▼
Nemotron via OpenRouter  ──►  Zod-validated CallAnalysis
        │
        ▼
Transaction: Call summary + ExtractedFact rows + MemorySync(PENDING)
        │
        ▼
Walrus Memory Mainnet
  analyzeAndWait() → relayer extracts, encrypts, uploads, indexes
        │
        ├── SUCCESS → MemorySync(COMPLETED) + job/blob references
        └── FAILURE → MemorySync(FAILED) + retry action

Memory Explorer
  PostgreSQL graph ──► recommendations ──► Walrus recall
  deal facts + learning techniques + organizational playbooks
```

### Persistence separation

PostgreSQL and Walrus are deliberately tracked as two different truths:

- **PostgreSQL success** means the call, summary, and facts were committed.
- **Walrus success** means the SDK confirmed persistence of all extracted memories.
- A failed Walrus write never appears as completed. `MemorySync` retains status, attempts, errors, timestamps, and job/blob references.

## Walrus Memory design

Three namespaces are used:

| Namespace | Purpose |
|---|---|
| `dealos_demo_deals` | Deal-specific call experiences |
| `dealos_demo_learning` | Personal sales techniques |
| `dealos_demo_organization` | Organizational cases and playbooks |

Memory text includes stable source identifiers (deal ID, call ID, call number, observed date, evidence) so writes remain attributable and retries cannot be confused with other deals.

### Verify on Mainnet

The UI now exposes direct Mainnet links:

- `/intelligence?tab=walrus` — Walrus syncs, semantic recall, per-blob Walruscan links, owner/account Suiscan links, and a Tatum Sui Mainnet proof card.
- `/learning` — personal-learning recall results with Mainnet blob links.
- `/deals/[dealId]` — deal-scoped Walrus recall.

CLI checks:

```bash
# Enumerate the namespace, show indexed blobs, and recall a deal's memories
npm run memory:inspect -- <dealId> "What objections were raised?"

# Verify a blob exists on the Walrus Mainnet aggregator
curl -I https://aggregator.walrus-mainnet.walrus.space/v1/blobs/<blobId>
```

Walrus Memory does not provide an end-user namespace browser. The relayer API, the UI links above, and the commands are the source of truth.

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn-style primitives |
| Graph | `@xyflow/react` |
| Database | PostgreSQL 17 (Docker Compose), Prisma 6 |
| LLM | NVIDIA Nemotron via OpenRouter, Zod validation |
| Memory | Walrus Memory Mainnet (`@mysten-incubation/memwal`) |
| Blockchain RPC | Tatum Sui Mainnet |
| Validation / tests | Zod, Vitest |

## Quick start

**Requirements:** Node 22 (`nvm use`), Docker Desktop, PostgreSQL via Compose, OpenRouter key, Walrus Memory delegate key + account ID.

```bash
nvm use
npm install
docker compose up -d

cp .env.example .env
# Fill in OPENROUTER_API_KEY, MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, TATUM_API_KEY
# TATUM_API_KEY is required for the mainnet proof card and /api/health/tatum

npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000.

### Load the demo

1. Open `/deals` and create a deal (or use an existing demo deal).
2. Paste a synthetic transcript into the deal workspace.
3. Watch the call move through analysis and Walrus sync.
4. Open **Memory Explorer** and generate a recommendation.
5. Open `/intelligence` and click **Load synthetic demo** to populate organizational cases, strategies, and playbooks.
6. Open `/learning` to add a technique and watch its Walrus sync status.


## Verification

```bash
npm run demo:preflight
npm run lint
npm run typecheck
npm test
npm run test:integration   # real Walrus Mainnet write + recall
npm run test:phase2        # full two-call deal workflow against real services
npm run build
npm run health -- --write  # mutating database + Walrus checks
```

The Phase 2 integration test creates a two-call deal, runs real Nemotron analysis, persists facts, completes Walrus writes, recalls deal-scoped memories, and cleans up its deal row.

## Project structure

```text
src/
├── app/
│   ├── api/                 # Deals, calls, memory, recommendations, learning, organization
│   ├── deals/               # Listing, workspace, call detail, memory explorer
│   ├── intelligence/        # Organizational learning
│   ├── learning/            # Personal technique library
│   └── infrastructure/      # Live integration dashboard
├── components/
│   ├── deals/               # Transcript, timeline, facts, recall, retry
│   ├── memory/              # Graph, timeline, detail panel, recommendation UI
│   ├── learning/            # Technique library
│   └── organization/        # Cases, strategies, playbooks, Walrus health
├── lib/                     # Env, Prisma, LLM, memory, validation, analysis
├── services/                # Deal, call, LLM, Walrus, learning, organization
└── types/                   # Shared API/view types

prisma/schema.prisma
scripts/{health-check,db-persistence,memory-inspect}.mjs
tests/{unit,integration}
```

## Safety and limitations

- Use synthetic transcripts only. Never submit confidential customer data to a free model endpoint.
- Secrets are server-only and never use `NEXT_PUBLIC_`; logs exclude keys and full transcripts.
- Walrus `analyzeAndWait` can take 30–120 seconds per call. The UI treats this asynchronously.
- The Walrus SDK exposes no idempotency key for `analyzeAndWait`; retries are protected by stable IDs and the `MemorySync` completion guard, but a partial write after server acceptance may still require manual review.
- The synthetic organizational dataset is clearly labeled and must not be presented as real customer performance.

## License

Private hackathon project. Add a license before public distribution.
