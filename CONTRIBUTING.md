# Contributing to Kusanya

We're a small hackathon team moving fast toward a fixed deadline (see `docs/info.md` §3 and
`docs/build.md` §16). These rules keep five people shipping one coherent product.

## Ground rules

1. **The docs are the contract.** Build what `docs/solution.md` and `docs/build.md` specify.
   If reality disagrees with a doc, change the doc in the same PR (docs live with code here).
2. **UI law: shadcn/ui only.** No other component kits, no hand-rolled markup where a shadcn
   component exists. Follow the critical rules checklist in `docs/research.md` §8.3
   (semantic tokens, `gap-*` not `space-*`, Field-composed forms, `data-icon`, items in
   groups, Dialog/Sheet titles, Spinner+disabled for loading buttons, sonner toasts).
3. **Server owns money.** Payaza keys/PIN/secrets and Jev calls never appear in client
   bundles. All money math in integer minor units via `lib/money` (no floats).
4. **Webhook is truth.** Client callbacks and optimistic UI never mutate balances or ledger
   states — only verified webhooks/status queries do (`docs/build.md` §6.4–6.6).
5. **Every AI judgment is logged.** Jev requests/responses persist to `ai_extractions` and
   surface in the audit tab. No silent model calls.
6. **Demo reliability beats features.** A change that risks the 4-minute demo path
   (`docs/solution.md` §15) needs a Demo-Mode fixture + Playwright coverage in the same PR.

## Workflow

### Branches
- `main` — always deployable; protected; PRs only; CI must pass.
- `feat/<area>-<short>` (e.g. `feat/webhook-receiver`), `fix/…`, `docs/…`.
- Freeze: tag `demo-freeze` 2 hours before judging; after that, only `fix/demo-*` hotfixes.

### Commits
Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `demo:`.
Scope where useful: `feat(payaza): …`, `feat(jev): …`, `feat(ui): …`.

### Pull requests
Keep PRs small (<400 lines where possible). PR description must include:
- What & why (link the build.md section number you're implementing)
- Screenshots/GIF for any UI change (light + dark)
- Checklist:
  - [ ] Types: no `any` across boundaries; Zod schemas for external payloads
  - [ ] shadcn rules respected (research §8.3); no raw colors/`space-*`/manual z-index
  - [ ] State machine transitions covered by tests (illegal ones too)
  - [ ] Idempotency: unique references; webhook dedupe respected
  - [ ] Secrets: nothing new in client bundles; `.env.example` updated if new var
  - [ ] Demo Mode still works with this change (`pnpm dev` with `NEXT_PUBLIC_DEMO_MODE=true`)
  - [ ] `pnpm typecheck && pnpm lint && pnpm test` green; Playwright demo-path green for
        money-flow changes

### Definition of done (per build.md §16 phase)
CI green + Playwright demo-path passes + README build-log checkbox ticked.

## Areas & ownership (suggested split for 3–5 people)

| Area | Files | Skills |
|---|---|---|
| Payments spine | `lib/payaza/**`, webhook route, payouts, ledger | Backend |
| Intelligence | `lib/jev/**`, extraction UI, risk, audit | ML/AI + Backend |
| Merchant UI | `app/app/**`, `components/invoices|money|charts` | Frontend + shadcn craft |
| Buyer surfaces | `app/i/**`, `app/pay/**`, `components/buyer` | Frontend (perf, RSC) |
| Product/demo | deck, Demo Mode, seed data, E2E, docs | PM + Design |

## Environment & commands

```bash
pnpm install
cp .env.example .env.local
pnpm dev            # local dev (Demo Mode works without live keys)
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e            # Playwright (demo-path.spec.ts must stay green)
pnpm sandbox:smoke  # real Payaza test-rail smoke (needs test keys)
pnpm db:push        # drizzle schema sync (hackathon phase; migrations committed)
```

## Code style

- TypeScript strict; ESLint + Prettier defaults from the Next.js template.
- File names kebab-case; components PascalCase; one export per UI file where practical.
- Zod schemas next to what they validate (`types.ts` per lib area).
- Money: `Minor` (integer) branded type from `lib/money`; formatting only at edges
  (`Intl.NumberFormat`, explicit currency codes, mono font per design system).
- Dates: `date-fns`, always store UTC, render `Africa/Nairobi` for merchant, buyer-local
  for buyer pages.

## Conduct

See [`CODE-OF-CONDUCT.md`](CODE-OF-CONDUCT.md). Disagreements get resolved by the tie-break
rule: **the demo script wins** — whatever best serves `docs/solution.md` §15 within the
deadline.

## Security issues

Never file public issues for vulnerabilities or leaked keys — follow
[`SECURITY.md`](SECURITY.md).
