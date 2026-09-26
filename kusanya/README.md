# Kusanya — the app

Invoice-first international collections for Kenyan SME exporters.
WhatsApp paste → AI extraction ([TypeSafe Jev](https://docs.typesafe.ai), typed judgments —
code resolves every number and date) → invoice → risk screen → Payaza-hosted checkout
(card/Apple Pay/Google Pay in USD, or KES/UGX/TZS mobile money) → webhook-confirmed →
transparent settlement waterfall → KES payout to M-Pesa/bank → automatic agent splits.

Built for **[Borderless Kenya](https://hackathon.payaza.africa/)** (Payaza × Hackhouse),
**Track #03 — SME and exporter collections**. Product/strategy docs live in
[`../docs/`](../docs/); the engineering spec is [`../docs/build.md`](../docs/build.md);
as-built deviations are documented in its §19.

## Quickstart (zero external services)

```bash
pnpm install
cp .env.example .env.local   # defaults work — Demo Mode auto-enables without Payaza keys
pnpm db:migrate              # PGlite (embedded WASM Postgres) → kusanya/data/pglite
pnpm seed:demo               # Wanjiru / FreshLeaf Exports + 5 invoices across every state
pnpm dev                     # http://localhost:3000
```

No Postgres server, no Docker, no API keys required. The database is embedded
([PGlite](https://pglite.dev)) and Demo Mode replays recorded Payaza webhook payloads
through the **same** verification + completion code paths as production.

### Demo credentials

| What | Value |
|---|---|
| Login | `wanjiru@kusanya.demo` / `kusanya-demo-2026` |
| Payout confirm code | `123456` |
| Test card (sandbox) | Visa `4508 7500 1574 1019`, exp `01/39` approve · `05/39` decline, any CVC |
| Demo hub | `/demo` — reset + 7 scenario deep-links |

### Going live (Payaza sandbox)

Fill `PAYAZA_PUBLIC_KEY`, `PAYAZA_SECRET_KEY`, `PAYAZA_WEBHOOK_SECRET` in `.env.local`
(`X-TenantID: test`), then `pnpm sandbox:smoke` to verify real test-rail connectivity.
Demo Mode switches off automatically once keys are present (override:
`NEXT_PUBLIC_DEMO_MODE=false`).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js 16 (Turbopack) dev / production build / serve |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | ESLint 10 flat config (see note below) |
| `pnpm test` | Vitest unit suite — **98 tests**: money/fees/FX, waterfall, state machine, webhook HMAC-SHA512, risk engine, extraction, guardrails |
| `pnpm test:e2e` | Playwright (system Chrome) — money-path flow: reset → login → SENT invoice → replay M-Pesa webhook → badge flips **Sent → Paid** |
| `pnpm db:migrate` / `db:generate` | Drizzle migrations against PGlite |
| `pnpm seed:demo` | Idempotent demo seed (FK-safe wipe + reseed) |
| `pnpm sandbox:smoke` | Real Payaza test-rail smoke (skips gracefully without keys) |
| `pnpm replay:webhook` | Replay a stored webhook payload through the live pipeline |

## Architecture in one breath

- **Next.js 16 App Router** — RSC pages read Postgres directly via Drizzle; mutations are
  `"use server"` actions; buyer-facing routes are token-scoped (`/i/[token]`), merchant
  routes session-scoped with `mustGet*(id, businessId)` IDOR guards.
- **Money contract** — DB stores `numeric(18,2)` **minor units as strings**; the wire carries
  major units; all math is integer/BigInt (`lib/money/`). Currencies are never cross-summed.
- **Single completion paths** — webhooks, demo replays and polling all converge on the same
  `applyCollectionResult` / `applyPayoutResult` / state-machine transitions (`lib/payments/`).
  Payaza sends no webhook retries, so `/api/cron/reconcile` (vercel.json) closes gaps.
- **Jev discipline** — AI returns *typed judgments* (citations + confidence); deterministic
  code resolves every amount, date and currency (`lib/jev/`). LOW-confidence fields are gated
  in the review wizard; guardrails block uncited numbers and threat patterns (fail-closed).
- **Risk engine** — weighted score (sanctions 40 / anomaly 20 / first-buyer 15 /
  jurisdiction 15 / mismatch 10), thresholds pass<40≤review<70≤hold, fail-closed sanctions
  floor, human override with mandatory reason (audited).
- **UI law** — strictly [shadcn/ui](https://ui.shadcn.com): semantic tokens only, Field forms,
  Badge variants, Empty/Skeleton patterns, `data-icon`, `gap-*`. One global `TooltipProvider`
  lives in `components/providers.tsx`.

## Known environment notes

- **Next.js 16 ≠ the Next.js you know**: async `params`/`searchParams`, `await headers()`,
  `next lint` removed (ESLint runs directly), Turbopack default. See `AGENTS.md`.
- **ESLint 10 × eslint-plugin-react 7.37.5**: `settings.react.version` is pinned to a literal
  (the plugin's `"detect"` path calls a removed API). Two React-Compiler preview rules
  (`react-hooks/purity`, `react-hooks/set-state-in-effect`) are set to `warn` — they flag
  legitimate RSC clock reads and external-store sync; 4 documented warnings, 0 errors.
- **PGlite is lazily constructed** (`lib/db/client.ts` proxy) so `next build` workers that
  merely import route graphs never boot WASM.
- `"use server"` modules may only export async functions — shared Zod schemas live in
  `lib/validators/`.
