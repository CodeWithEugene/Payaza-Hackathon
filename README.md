# Kusanya 🇰🇪

> **Kusanya** (Kiswahili: *to collect, to gather*) — invoice-first international collections
> for Kenyan SME exporters. Buyers pay in USD by card/Apple Pay/Google Pay (or in KES/UGX/TZS
> by mobile money); exporters settle to M-Pesa or bank in KES with total fee/FX transparency.
> AI paperwork by [TypeSafe Jev](https://docs.typesafe.ai). Money rails by
> [Payaza](https://docs.payaza.africa). UI strictly [shadcn/ui](https://ui.shadcn.com).

Built for **[Borderless Kenya](https://hackathon.payaza.africa/)** — the Payaza × Hackhouse
Nairobi hackathon solving cross-border payments for East African trade.
**Track #03 — SME and exporter collections.**

## ▶ Live demo — https://kusanya.codewitheugene.top

Hosted on **Vercel** (Node serverless + **Neon Postgres** free tier, `iad1`); push to `main`
on GitHub (`CodeWithEugene/Payaza-Hackathon`, Root Directory `kusanya/`) auto-deploys production.
`https://kusanya-gamma.vercel.app` remains a working mirror alias. Runs on **Payaza's real
sandbox rails** (test tenant, since 2026-09-28): M-Pesa/momo collections, payment links and
split accounts hit Payaza's API; webhooks arrive HMAC-signed; invoice extraction is live
TypeSafe Jev. **Payouts stay simulated** (labeled) until Payaza provisions the test account's
KES wallet, and **demo tools** (reset, replay, simulated settlement) stay on for judging. The
topbar badge says which mode is active.

| | |
|---|---|
| Login | `wanjiru@kusanya.demo` / `kusanya-demo-2026` |
| Payout confirmation code | `123456` |
| Test card (buyer portal) | Mastercard `5111 1111 1111 1118` (no 3DS, instant) or Visa `4508 7500 1574 1019` (3DS) · expiry `01/39` approves, `05/39` declines · CVV `100` · mobile money: any phone number (sandbox auto-approves) |
| Restore the canonical story | `/app/settings` → *Demo Mode* → Reset (or the `/demo` launcher) — wipes + reseeds; signs you out |
| Dark mode | Toggle in the topbar / landing nav / buyer page, or press **`d`** anywhere — Light · Dark · System, persisted per browser |
| Telegram bot | [@kusanya_invoice_bot](https://t.me/kusanya_invoice_bot): connect once in `/app/settings` → Telegram, then forward any buyer order; it replies with a screened invoice + Payaza link and a **Send To Buyer** button, and messages you when Payaza confirms payment |
| Help chat + accessibility | Bottom-right on every page: GLM (OpenRouter) answers grounded in the curated help center; accessibility menu (text size, contrast, motion, links, spacing, theme) |
| Exports | CSV/PDF on every table, PNG/SVG on every chart, PDF reports (dashboard, analytics), invoice + receipt PDFs (merchant and buyer) |
| Developers | Public docs at [`/developers`](https://kusanya.codewitheugene.top/developers), API keys at `/app/developers`, REST API v1 (`Authorization: Bearer ksn_test_…`), OpenAPI at `/api/v1/openapi.json` |

### Brand

The **"k." monogram** — a lucide-style vector mark: the arms of the *k* converge into the stem
(*kusanya* = to gather), and the period rests on the baseline as the gathered coin. Strokes are
`currentColor` in-app (`components/brand/logo.tsx`), so it adapts to light/dark automatically.
Fixed-ink files with transparent backgrounds live in `kusanya/public/logo/`:

| File | Use |
|---|---|
| `kusanya-mark.svg` / `-512.png` / `-512-white.png` | The mark alone (adaptive SVG · dark-ink PNG · light-ink PNG) |
| `kusanya-logo-light.svg` / `-light-1216.png` | Mark + wordmark for LIGHT backgrounds (ink #0a0a0a) |
| `kusanya-logo-dark.svg` / `-dark-1216.png` | Mark + wordmark for DARK backgrounds (ink #fafafa) |

Favicon: `kusanya/app/icon.svg` (served at `/icon.svg`).

Local dev/e2e are unaffected: they run embedded PGlite (`.env.local` intentionally has **no**
`DATABASE_URL`; production gets it from the Neon integration).

---

## The problem in one paragraph

Small Kenyan exporters (agriculture, crafts, digital services) lose **3–8% of every invoice**
to wire fees, PayPal-style withdrawal friction and opaque FX — and wait **3–10 business days**
for money. They invoice from WhatsApp, have no global PSP merchant account, and pay agents by
hand. Kusanya turns a WhatsApp message into a professional invoice with a Payaza payment
link, confirms payment by webhook, settles KES to M-Pesa with itemized transparency, auto-pays
forwarding agents via split settlement, and screens every invoice with calibrated AI risk
judgments. Full story: [`docs/solution.md`](docs/solution.md).

## Documentation map

| Doc | Contents |
|---|---|
| [`docs/info.md`](docs/info.md) | Everything about the hackathon: rules, tracks, judging criteria, prizes, deadlines, submission form, gotchas |
| [`docs/research.md`](docs/research.md) | Deep research dossier: Payaza platform & API deep-dive (57 doc pages + OpenAPI parsed), rail × corridor fit matrix, TypeSafe/Jev research, shadcn/ui research, market context, Jev-driven decision analysis (raw outputs), risks |
| [`docs/solution.md`](docs/solution.md) | Complete solution design: personas, user journeys (J1–J8), feature set (MVP/v1/v2), AI layer design, UX spec, business case, compliance posture, judging-criteria self-audit, 4-minute demo script, pilot proposal |
| [`docs/build.md`](docs/build.md) | Full engineering spec: stack decisions, repo structure, DB schema, Payaza integration layer (exact endpoints, webhooks, state machine), Jev layer, page-by-page UI spec (shadcn components, buttons, states), security checklist, test plan, Demo Mode, deployment, build timeline |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How we work: branches, commits, shadcn rules, definition of done |
| [`SECURITY.md`](SECURITY.md) | Secrets handling, webhook security, vulnerability reporting |
| [`CODE-OF-CONDUCT.md`](CODE-OF-CONDUCT.md) | Team conduct |
| [`LICENSE.md`](LICENSE.md) | MIT |

## Status

- [x] Hackathon researched end-to-end (site + register form + all Payaza docs)
- [x] Track & concept decided via Jev decision analysis (research §9)
- [x] Solution designed (solution.md)
- [x] Engineering spec written (build.md)
- [x] **Deck built & uploaded** — `docs/deck/kusanya-deck.pdf` → [Drive link](https://drive.google.com/file/d/1B0eNGHWUOt4l_nGorTiSsaccVXpFqNFg/view?usp=sharing)
- [x] Idea text finalized — solution.md Appendix A.1 (plain-text, paste-ready)
- [x] **Team Technetians registered** — submission confirmed (record: solution.md Appendix C)
- [x] Phase 1 skeleton (build.md §16)
- [x] Phase 2 money spine — single completion paths, webhook HMAC-SHA512, reconciliation cron
- [x] Phase 3 AI layer — Jev extraction + guardrails + risk engine (fail-closed)
- [x] Phase 4 settlement & trust — waterfall, splits (inversion documented), payouts, rails
- [x] Phase 5 demo hardening — Demo Mode replay hub, seeded personas, e2e green
- [x] Payaza sandbox access confirmed (Payaza Integration Support, 2026-09-28: momo, payouts,
      checkout and splits all enabled in test mode) — production switched to real sandbox rails
- [ ] Payaza to provision the test account's KES wallet (`enquiry/main` returns no wallets →
      payouts can't get an `account_reference`; payouts simulated until then)

### Verification (as-built)

| Gate | Result |
|---|---|
| `pnpm build` (Next 16, production) | exit 0 — 37 routes, no WASM aborts |
| `pnpm typecheck` (tsc strict) | 0 errors |
| `pnpm lint` (ESLint 10) | 0 errors (4 documented preview-rule warnings) |
| `pnpm test` (Vitest) | **105/105 passing** — money, FX, waterfall, state machine, webhook signature, risk, extraction, guardrails, Payaza URL join, payment-link builder |
| `pnpm sandbox:smoke -- --collect` | **real Payaza sandbox**: KES 10 M-Pesa prompt `09 PENDING` → test funding `00` → check-status `Completed` (fee 0, payer name, currency) |
| `pnpm test:e2e` (Playwright, system Chrome) | **4/4 passing against live sandbox keys + live Jev** (wizard creates a real Payaza USD payment link) — collection: reset → SENT invoice → M-Pesa replay → Paid · payout: Settled → confirmation gate (wrong code refused, money unmoved) → Imefika! Completed · wizard: WhatsApp paste → Jev extraction → reviewed invoice created, screened & sent |
| Runtime smoke (production server) | all public + 9 authed routes 200 · extraction returns Dubai Fresh FZE / USD 1,150.00 / due +5d · lifecycle sent → paid → settled · wallets + notification outbox live |

## Stack (as-built — see build.md §2 + §19)

Next.js **16.3.4** (App Router, Turbopack) · React 19.2 · TypeScript strict · Tailwind CSS v4 ·
**shadcn/ui** · **PGlite** (embedded WASM Postgres) + Drizzle ORM · Zod v4 · TanStack Query ·
better-auth · **payaza-web-sdk** + Payaza REST · **@typesafe-ai/sdk** (Jev, Demo-Mode
deterministic fallback) · Vercel (crons in `vercel.json`) · Vitest + Playwright · pnpm

## Quickstart

```bash
cd kusanya
pnpm install
cp .env.example .env.local   # defaults work — Demo Mode auto-enables without Payaza keys
pnpm db:migrate              # embedded PGlite, no database server needed
pnpm seed:demo               # Wanjiru / FreshLeaf Exports + 5 invoices across every state
pnpm dev                     # http://localhost:3000
```

Login `wanjiru@kusanya.demo` / `kusanya-demo-2026` · payout code `123456` ·
test card Visa `4508750015741019` (`01/39` approve, `05/39` decline).
Full guide: [`kusanya/README.md`](kusanya/README.md).

## Key decisions (evidence in research.md §9)

1. **Track 3 — SME/exporter collections.** Jev: best overall track (P=0.49), best
   pilot-pathway fit (P=0.81); Track 1 rail-depth captured via built-in UGX/TZS/KES momo
   expansion. Rwanda excluded — Payaza documents no RWF rail (research §4.7).
2. **Product concept "Kusanya"** won every judged dimension head-to-head (P(win)=0.59 vs
   0.41 runner-up; Payaza-infrastructure-use score 2.90/3 at 0.90 confidence).
3. **Name "Kusanya"** chosen by Jev (P=0.56) for Kenyan audience fit + no brand clashes.
4. **AI = calibrated decision primitives in the payment pipeline** (extraction, composite
   risk, intent routing, guardrails) — not a chatbot.
5. **Demo moves real sandbox money** on Payaza test rails, with a deterministic Demo-Mode
   fallback (replayed recorded payloads).

## Team — Technetians

Registered for Borderless Kenya, **Track #03** (SME & exporter collections).

| Name | Register-form role | Email | LinkedIn |
|---|---|---|---|
| Eugene Mutembei | Software Engineer (ML/AI) | eugenegabriel.ke@gmail.com | [in/eugene-mutembei](https://www.linkedin.com/in/eugene-mutembei/) |
| Washington Adiadio | Software Engineer (ML/AI) | washingtonowade200@gmail.com | [in/washington-adiado](https://www.linkedin.com/in/washington-adiado/) |
| Jael Nyambura | Data Scientist | jaelnwainaina@gmail.com | [in/jael-wainaina](https://www.linkedin.com/in/jael-wainaina-b1107a282/) |

Full registration record as submitted: `docs/solution.md` **Appendix C**.

## Links

- Hackathon: https://hackathon.payaza.africa/ · Register: https://hackathon.payaza.africa/register
- Payaza docs: https://docs.payaza.africa/ · Dashboard: https://business.payaza.africa
- TypeSafe/Jev: https://docs.typesafe.ai · shadcn/ui: https://ui.shadcn.com
- Hackhouse Africa: https://hackhouse.africa

---

*"Build for the person who feels it every week."* — the challenge, verbatim. That person is
Wanjiru (solution.md §5). Everything in this repo is for her.
