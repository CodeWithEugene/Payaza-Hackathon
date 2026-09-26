# Kusanya 🇰🇪

> **Kusanya** (Kiswahili: *to collect, to gather*) — invoice-first international collections
> for Kenyan SME exporters. Buyers pay in USD by card/Apple Pay/Google Pay (or in KES/UGX/TZS
> by mobile money); exporters settle to M-Pesa or bank in KES with total fee/FX transparency.
> AI paperwork by [TypeSafe Jev](https://docs.typesafe.ai). Money rails by
> [Payaza](https://docs.payaza.africa). UI strictly [shadcn/ui](https://ui.shadcn.com).

Built for **[Borderless Kenya](https://hackathon.payaza.africa/)** — the Payaza × Hackhouse
Nairobi hackathon solving cross-border payments for East African trade.
**Track #03 — SME and exporter collections.**

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
- [ ] **Idea submitted at hackathon.payaza.africa/register** ⏰ deadline Sat 26 Sept 2026, 23:59 EAT
- [ ] Payaza sandbox access confirmed (email support@payaza.africa — Kenya/UGX/TZS collections are on-request)
- [ ] Phase 1 skeleton (build.md §16)
- [ ] Phase 2 money spine — sandbox smoke green
- [ ] Phase 3 AI layer
- [ ] Phase 4 settlement & trust
- [ ] Phase 5 demo hardening — Playwright demo-path green, deck rehearsed

## Stack (planned — see build.md §2)

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · **shadcn/ui**
(Radix base, `nova` preset) · PostgreSQL (Neon) + Drizzle ORM · Zod v4 · TanStack Query ·
better-auth · **payaza-web-sdk** + Payaza REST · **@typesafe-ai/sdk** (Jev) · Resend ·
Africa's Talking · Vercel · Playwright/Vitest · pnpm

## Quickstart (once Phase 1 lands)

```bash
pnpm install
cp .env.example .env.local     # fill Payaza test keys, DATABASE_URL, TYPESAFE_API_KEY
pnpm db:push                   # drizzle-kit push
pnpm seed:demo                 # Demo Mode fixtures
pnpm dev                       # http://localhost:3000  (Demo Mode: no live keys needed)
pnpm sandbox:smoke             # real Payaza test-rail smoke test (needs test keys)
```

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

## Team

| Name | Title | Register-form role (suggested mapping) |
|---|---|---|
| Eugene Mutembei | Software Engineer | Frontend Developer *(or Software Engineer (ML/AI))* |
| Washington Adiadio | Software Engineer | Backend Developer *(or Software Engineer (ML/AI))* |
| Jael Nyambura | Data Scientist | Data Scientist |

The form's role enum has no plain "Software Engineer" — closest is **Software Engineer
(ML/AI)**. Tip: mapping the two SWEs to Frontend/Backend shows complementary coverage
(product + design gaps are covered by the AI-assisted workflow and documented in
`docs/build.md`); alternatively both pick Software Engineer (ML/AI), which is literally
true for the Jev layer. Team minimum is 3 — we are exactly at it.

## Links

- Hackathon: https://hackathon.payaza.africa/ · Register: https://hackathon.payaza.africa/register
- Payaza docs: https://docs.payaza.africa/ · Dashboard: https://business.payaza.africa
- TypeSafe/Jev: https://docs.typesafe.ai · shadcn/ui: https://ui.shadcn.com
- Hackhouse Africa: https://hackhouse.africa

---

*"Build for the person who feels it every week."* — the challenge, verbatim. That person is
Wanjiru (solution.md §5). Everything in this repo is for her.
