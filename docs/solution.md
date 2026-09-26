# solution.md — Kusanya: The Complete Solution Design

> **Kusanya** (Kiswahili: *to collect, to gather*) — invoice-first international collections
> for Kenyan SME exporters, built on Payaza rails with calibrated AI (TypeSafe Jev).
>
> Hackathon track: **#03 — SME and exporter collections** (Borderless Kenya, Payaza × Hackhouse).
> Evidence for this choice: `docs/research.md` §5, §9 (Jev decision analysis: best overall
> track P=0.49; best pilot-pathway fit P=0.81; concept wins all five judged dimensions).
> Engineering spec: `docs/build.md`.

---

## 1. Executive Summary

Small Kenyan exporters — the flower aggregator in Naivasha, the soapstone crafts co-op in
Kisii, the macadamia trader in Murang'a, the Nairobi design studio billing a client in
London — lose **3–8% of every invoice** to wire fees, PayPal-style withdrawal friction, and
bad FX, and wait **3–10 business days** for money that should arrive today. They invoice on
WhatsApp and Word, have no merchant account with a global PSP, and rely on expensive
intermediaries exactly as the challenge text describes.

**Kusanya replaces that stack with one mobile-first workflow:**

1. The exporter describes an order the way they already communicate — a WhatsApp message, a
   voice note transcript, or a photo of a handwritten note. **Jev (TypeSafe) extracts a
   structured invoice** (buyer, items, amounts, currency, due date) with calibrated
   confidence; low-confidence fields are highlighted for one-tap correction.
2. Kusanya generates a **professional invoice with a Payaza payment link / hosted checkout**:
   the international buyer pays in **USD by card, Apple Pay or Google Pay**; a regional buyer
   in **UGX/TZS/KES by mobile money**.
3. On the Payaza webhook ("Funds Received"), Kusanya marks the invoice paid and **settles to
   the exporter's M-Pesa or Kenyan bank account in KES** via Payaza payouts, with an honest,
   itemized **fee/FX transparency panel** and a **settlement ETA** derived from Payaza's real
   SLAs (T+1 local, T+3–5 USD).
4. Partners get paid automatically: the **forwarding agent, the co-op, or the commission
   seller receives their cut at settlement** via Payaza split settlements (or an automated
   payout leg), with zero manual bookkeeping.
5. Every transaction is **risk-screened by Jev composite scores** (sanctions language,
   anomalous amounts, first-time-buyer patterns) with confidence-gated routing: auto-proceed,
   merchant-confirm, or hold-for-review — an auditable AML story that a licensed PSP can pilot.

**One-liner:** *Kusanya gets Kenyan exporters paid by anyone, anywhere, in the currency their
buyer has — and puts KES in their M-Pesa, transparently, with AI doing the paperwork.*

**Why this wins the five criteria** (mapping detailed in §14): real weekly persona pain
(quantified), six Payaza product areas used structurally (not bolted on), pilot-feasible in
months because Payaza holds the licenses and we hold the workflow, UX designed for a
non-technical SME owner on a mid-range Android, and a demo that moves real sandbox money
end-to-end in under 4 minutes.

---

## 2. Problem Statement (deep)

### 2.1 The persona's week (composite from the challenge text + research §7)

**Wanjiru runs "FreshLeaf Exports"** — aggregates French beans and macadamia from 40
smallholders in Murang'a, sells to wholesalers in Dubai, London and Amsterdam, and does
30–60 orders/month, average invoice USD 800–6,000.

Her week, without Kusanya:

| Pain | Mechanism | Cost |
|---|---|---|
| **Invoicing is informal** | Orders arrive as WhatsApp voice notes/photos; invoices typed in Word or hand-written | Errors, disputes, unprofessional image, hours of admin |
| **Collection is the bottleneck** | Buyer must wire via SWIFT (USD 25–45 + intermediary deductions) or PayPal (withdrawal holds, ~5% + poor FX via third parties) | **3–8% of invoice value** + failed payments when buyers refuse wires for small amounts |
| **Cash float kills working capital** | 3–10 business days from invoice to KES-in-hand; smallholders must be paid **before** she collects | Bridge loans at 3–8%/month, or lost supply loyalty |
| **FX opacity** | Bank applies its own rate on arrival; she can't quote confidently | 1–3% hidden loss; quotes padded "just in case" → lost orders |
| **Agent/co-op payouts are manual** | Commission to her buying agent, transport cut to the forwarder — paid by hand or M-Pesa one-by-one | Leakage, disputes, hours per week |
| **Compliance burden lands on her** | Buyer asks for invoices/proof; bank asks questions on inbound FX | Stalled payments, frozen funds |

**Frequency:** weekly or daily (she ships 1–3 orders/day). **Quantifiable:** at USD 30k/month
volume, 4% leakage = **USD 1,200/month lost** — more than the winner's prize, every month.

### 2.2 Why existing options fail (research §7.6)
- **SWIFT wires:** fees + delay + paperwork; buyers under USD 2k often refuse outright.
- **PayPal/Wise/Payoneer:** withdrawal friction to Kenya, no M-Pesa-native settlement, no
  EAC momo, weak invoicing for informal SMEs; Stripe doesn't serve Kenya-registered SMEs.
- **Banks' merchant acquiring:** requires documentation informal SMEs lack; slow onboarding.
- **Cash/money-transfer shops (EAC trade):** 3–6% bureau spreads, theft risk, no ledger.
- **Generic PSP checkout pages:** solve *acceptance* but not the exporter's *workflow*
  (invoice → collection → conversion → settlement → partner splits → follow-up). That
  workflow gap is Kusanya.

### 2.3 Problem–rail match (why Payaza is the *natural* fit — per challenge text)
Payaza uniquely combines, under one API and one license umbrella: **international card/Apple
Pay/Google Pay checkout (USD in)** + **payment links** + **KES MoMo (M-Pesa) and kepss bank
payouts (KES out)** + **UGX/TZS/KES momo collections (EAC in)** + **split settlements** +
**webhooks/status APIs** + multi-currency wallet balances. Kusanya is the *workflow layer*
that turns those rails into something a Murang'a aggregator can use from her phone. Nothing
in the demo is possible without Payaza; nothing in Payaza's docs is mocked.

---

## 3. Why Now

1. **Diaspora + export FX pressure:** remittances and exports are Kenya's top FX sources;
   CBK and banks have pushed digital trade finance; KES volatility (2023–24) made FX
   transparency a survival skill for SMEs (research §7.4).
2. **Payaza's East African expansion:** licensed NG + GH, offices through Kampala, Kenya
   rails live in docs (M-Pesa collections + payouts), and this hackathon exists precisely to
   seed Kenya-market products on their rails. A pilot-ready exporter product is strategically
   aligned with their stated merchant growth (10k+ Storefront merchants).
3. **AI inflection:** calibrated decision models (TypeSafe System One) now make
   *per-invoice* extraction/screening economically viable at SME ticket sizes — impossible
   with per-token LLM pricing at 4% margins.
4. **EAC digital trade momentum:** one-stop border posts + momo ubiquity mean the *next*
   corridor expansion (UGX/TZS collections) is a config toggle, not a rebuild.

---

## 4. The Solution: Product Definition

### 4.1 What Kusanya IS
A **mobile-first web app** (PWA) with two surfaces:

- **Merchant app** (the exporter): dashboard, AI invoice creation, buyer directory,
  payments/settlement ledger, partner splits, payouts, analytics, settings/KYC.
- **Buyer-facing pages** (hosted by us + Payaza): invoice view (`/i/<token>`) with "Pay now"
  that launches **Payaza Checkout SDK / payment link** — buyer never needs an account.

And three engines behind it:
1. **Payments engine** — Payaza integration layer: collections (card/Apple/Google Pay/links/
   momo), payouts (KES momo/kepss; UGX/TZS momo), splits, webhooks, reconciliation state
   machine.
2. **Intelligence engine** — Jev decision primitives: invoice extraction, buyer risk
   composite, intent routing of buyer messages, guardrails on drafted communications.
3. **Trust engine** — transparency layer: fee/FX breakdown per transaction, settlement ETA
   from real Payaza SLAs, audit trail of every AI judgment (probabilities + criteria),
   receipt-grade ledger exports.

### 4.2 What Kusanya is NOT (scope discipline)
- Not a wallet or bank (no balance custody — funds ride Payaza's licensed accounts).
- Not a remittance app (that's track 5; different persona, crowded — research §9).
- Not an FX speculator (no rate games; honest pass-through with visible margin).
- Not building Rwanda corridor (no RWF rail exists — research §4.7; roadmap-only).
- Not a chatbot (AI = typed decisions inside the pipeline, never free-text money movement).

### 4.3 Positioning statement
> For **Kenyan SME exporters** who lose value and days collecting from international buyers,
> **Kusanya** is an **invoice-first collections platform** that turns a WhatsApp message into
> a paid invoice and settles KES to M-Pesa with total transparency — unlike **PayPal, bank
> wires or generic payment gateways**, Kusanya owns the exporter's whole workflow and runs on
> **Payaza's licensed multi-market rails**.

---

## 5. Target Audience & Personas

### P1 — Primary: "Wanjiru, SME exporter" (the judged persona)
- 34, runs FreshLeaf Exports (agri-aggregator), Murang'a → Nairobi. Mid-range Android
  (Tecno/Redmi), data-conscious, lives in WhatsApp, basic Excel. Ships 30–60 orders/month,
  USD 800–6,000 each. Has a KES bank account + M-Pesa; no global PSP merchant account.
- **Goals:** get paid fast and whole; quote confidently in USD; pay smallholders/agents
  without drama; look professional to European buyers.
- **Frustrations:** wire fees, PayPal holds, "where is my payment?" anxiety, manual agent
  payouts, invoice typos causing disputes.
- **Tech comfort:** can use M-Pesa blindfolded; will abandon anything that feels like
  "banking software". Needs: Swahili-friendly microcopy, big tap targets, SMS/WhatsApp
  notifications, offline-tolerant.
- **Kusanya promise:** "Tuma invoice, lipwa leo" — send an invoice, get paid today.

### P2 — Secondary: "Susan, the international buyer"
- 48, produce wholesaler in London. Pays 10+ suppliers across Africa/Asia monthly by wire
  and card. Hates onboarding new payment vendors; wants a card-payment link and a receipt.
- **Goals:** pay by card/Apple Pay in USD in <2 minutes, get a proper invoice PDF + receipt,
  trust the beneficiary.
- **Kusanya promise:** a clean branded invoice page, Payaza's hosted secure checkout,
  card/Apple/Google Pay, instant email receipt. **Zero signup.**

### P3 — Secondary: "Otieno, forwarding/clearing agent" (split beneficiary)
- Runs cargo consolidation Nairobi→Dubai; earns 2–5% per shipment; currently chases
  commissions manually.
- **Kusanya promise:** registered once as a split beneficiary; his cut lands automatically at
  settlement with a statement line per invoice. Turns Kusanya viral: agents onboard *their*
  exporter clients.

### P4 — Expansion: "Achieng', cross-border trader (EAC)"**
- Sells textiles Nairobi→Kampala/Dar; collects UGX/TZS momo today via risky cash-to-wallet
  chains. Kusanya's multi-currency collection (research §5) serves her with the same product
  — the track-1 depth inside our track-3 story.

### Anti-persona
- The crypto-arbitrage "forex guy", the dropshipper needing chargeback-proof high-risk
  acquiring: explicitly out of scope; Jev risk gates flag and hold such patterns (§8.4).

---

## 6. Value Proposition (per stakeholder)

| Stakeholder | Value | Measured by |
|---|---|---|
| Exporter (P1) | 3–8% leakage → ~1.5–2.5% all-in; days → same-day/next-day KES on M-Pesa; zero paperwork invoicing; auto agent splits; professional buyer experience | Cost-per-invoice saved; time-to-settle; invoices/month |
| Buyer (P2) | Card/Apple/Google Pay in own currency, 2-min checkout, receipts, no new vendor onboarding | Checkout completion rate; repeat buyer % |
| Agent (P3) | Automatic, statemented commissions | Splits settled on-time % |
| **Payaza (judge/pilot)** | New merchant segment (exporters) activated on checkout+links+payouts+splits; deeper rail utilization per merchant; fraud-screened volume; a pilotable product aligned with their Kenya expansion | TPV via Payaza rails; merchants onboarded in pilot |
| Ecosystem | Formalization of informal export trade (ledgers, receipts, screening) → credit data → future Payaza Boost lending hooks | Exporters with 6-month clean ledgers |

---

## 7. User Journeys (end-to-end, exhaustive)

### J1 — Onboarding (exporter, first run, target <3 minutes)
1. Lands on `kusanya.app` from a WhatsApp share → **"Anza — Get started"**.
2. Sign up: email or **phone + OTP** (Input OTP component) → business name, country Kenya,
   preferred payout rail (**M-Pesa number** or bank account + bank code from Payaza Bank
   Codes API).
3. KYC-lite tier 1 (start collecting small): full name, ID number, business type — stored,
   flagged "verification pending" (real KYB is Payaza-side for live keys; our tiering mirrors
   it — §13).
4. **Payout preferences:** settlement currency KES; auto-payout toggle (webhook → payout
   automatically vs. manual "Withdraw" button); partner/split setup wizard (optional, later).
5. Empty dashboard with a single pulsing CTA: **"Create your first invoice"** + a 30-second
   product tour (3 slides, skippable). Seed Demo Mode shows a realistic populated account.
- *Edge:* no smartphone? → USSD/SMS invoice-creation fallback is roadmap (v2); WhatsApp bot
  (Payaza "Chat and Pay" precedent) v1.5.

### J2 — Create invoice with AI (the magic moment)
1. Tap **"New invoice"** → three tabs (ToggleGroup): **Snap** (photo), **Paste** (WhatsApp
   text/voice transcript), **Manual** (form).
2. **Snap:** photograph a handwritten order note / buyer's PO. **Paste:** drop the WhatsApp
   message: *"Hi Wanjiru, please send 500kg French beans to Dubai Fresh Co, attn Susan,
   delivery next Friday, we'll pay USD 2.30 per kg as usual."*
3. Jev pipeline (single batched request — research §6.3): value extraction (amount/rate,
   quantity, currency, dates with deterministic resolution), Choice (buyer = which existing
   directory entry or new), Nouls (is this a firm order vs. enquiry; contains sanction-risk
   language; amount deviates >30% from this buyer's history).
4. **Review screen:** structured invoice draft appears — fields with **high confidence render
   filled; low-confidence fields highlighted amber** with the source snippet quoted
   (citation-check pattern) and one-tap corrections. Wanjiru fixes "Dubai Fresh Co" →
   directory match "Dubai Fresh Co. LLC" via Combobox.
5. Pricing panel: currency USD; **fee preview** ("Buyer pays by card: you receive ≈
   KES 129,340 after 1.9% + FX margin; settles by Thu" — honest math, §11.4); fee bearer
   choice (Business/Customer — maps to Payaza `fee_bearer_type`).
6. **Send:** generates invoice + **Payaza payment link** (or embedded checkout session);
   share sheet → **WhatsApp / copy link / email / QR code**. Buyer receives a branded
   invoice page.
- *Edge:* garbage photo → Jev confidence <0.4 → "We couldn't read this — try Manual" with
  the photo kept for retry. *Edge:* multi-item order → extraction returns items array;
  review screen shows editable DataTable rows.

### J3 — Buyer pays (Susan in London, <2 minutes, zero signup)
1. Opens `kusanya.app/i/<token>`: invoice summary, exporter branding, amount USD 1,150,
   due date, **"Pay securely"** (Button primary, full-width on mobile).
2. Tap → **Payaza Checkout SDK modal** (`connection_mode` per env): card, Apple Pay,
   Google Pay. (Payment-link variant: the Payaza hosted page directly — we support both;
   SDK for in-page trust, links for no-code fallback.)
3. 3DS if required → success screen + email receipt (our copy, Payaza reference).
4. Meanwhile server-side: checkout callback treated as **hint only** → status-query +
   webhook confirm (research §4.7-9) → invoice flips to **PAID** with a toast in Wanjiru's
   app and a WhatsApp/SMS notification.
- *Regional variant (P4):* buyer in Kampala opens the same invoice priced UGX → "Pay with
  MTN MoMo" → Payaza momo process-collection → USSD prompt on buyer's phone → webhook →
  PAID. (Jev Noul on the invoice routes which payment methods to display per currency.)

### J4 — Settlement & payout (the trust moment)
1. Webhook "Funds Received" (USD collection, T+3–5 SLA) → ledger entry **settled_pending_fx**
   → ETA shown ("KES on your M-Pesa by Thursday 16:00").
2. On conversion/settlement to KES balance (Payaza wallet), auto-payout (if enabled) fires
   `POST /payout-receptor/payout` — `transaction_type: mobile_money`, KES, to her M-Pesa;
   sender block populated (AML); unique reference per attempt; retry policy ours (no auto
   retries on Payaza side — research §4.3).
3. **Payout confirmation UX (safety-critical):** first-time or >KES 100k payouts require
   explicit confirm — AlertDialog showing **resolved beneficiary echo** (name she typed +
   number), amount, fee; **our own verification** since account-name enquiry is NG/GH-only
   (research §4.7-4): OTP to *her* phone re-confirms the destination.
4. Webhook NIP_SUCCESS → **"Paid to M-Pesa 07XX•••123 — KES 148,220"** + receipt + full
   transparency panel: gross USD → fee (itemized) → FX rate applied → net KES. Ledger
   exports CSV/PDF.
- *Edge:* NIP_FAILURE (wrong number) → funds reversed per Payaza semantics → in-app card
  with "Fix & resend" (pre-filled), never silent loss.

### J5 — Partner splits (Otieno's commission, automatic)
1. Wanjiru adds Otieno once: Split wizard → his bank/KES details → **Jev sanity-checks**
   (name/number format Nouls) → Payaza **Create Split Account** (`split_type: PERCENTAGE`,
   `split_value` = **what Kusanya/merchant keeps** — semantics per research §4.4) → code
   `SSA_…` stored.
2. Per invoice, she toggles "Include partners" → checkout carries `split_accounts:[{code}]`
   → at settlement Payaza routes Otieno's remainder share automatically.
3. Otieno gets a per-invoice statement line + monthly statement (v1: email PDF).
- *Fallback if KES split beneficiary unsupported (risk R2):* webhook-triggered **payout leg**
  to Otieno's M-Pesa with the same ledger semantics — identical UX, different rail.

### J6 — Follow-ups & collections ops (retention loop)
1. Invoice UNPAID past due → Jev **intent-routes** any buyer replies (promise-to-pay /
   dispute / spam); drafts a polite reminder (LLM draft allowed) but **every draft passes a
   Jev guardrail screen** before send (research §6.3) and Wanjiru approves with one tap —
   AI drafts, human sends (trust + compliance).
2. Reminders scheduled (day 1, day 3, day 7 past due) via WhatsApp/email; "Buyer promised
   payment Friday" captured as a ledger note from the intent classification.
3. Recurring buyers → **Subscriptions** (Payaza plans) for retainer-style digital-service
   exporters (P1 variant: the Nairobi design studio) — monthly auto-billing of the buyer's
   card with dunning handled by Payaza lifecycle APIs.

### J7 — Risk & hold journey (the compliance story judges will probe)
1. New buyer, first invoice USD 9,800, shipping to a high-risk jurisdiction, wording flags
   → Jev composite risk score > threshold → invoice enters **REVIEW** (amber), not blocked:
   Wanjiru sees plain-language reasons ("First-time buyer • Amount 3× their usual •
   Sanctions-language check: 12% — low") + actions: proceed / request deposit (auth-capture
   partial) / cancel.
2. Decision + probabilities written to the **audit trail** (immutable ledger append) — the
   artifact a compliance officer at Payaza would ask for in a pilot.
3. Extreme scores (P>0.9 sanctions hit) → hard hold + human escalation email. No black-box
   declines; every gate has a merchant-visible reason and an override with logging.

### J8 — Demo journey (judges, 4 minutes — full script §15)
Setup → AI invoice from pasted WhatsApp text → buyer pays by test card in checkout →
webhook flips states live → split preview → KES payout to test M-Pesa via sandbox funding →
transparency panel + audit trail. All on Payaza test rails; deterministic fallback = Demo
Mode replaying recorded payloads.

---

## 8. Feature Set

### 8.1 MVP — hackathon demo scope (must work end-to-end)
| # | Feature | Rails/AI used |
|---|---|---|
| F1 | Exporter auth + business profile + payout rail setup | — |
| F2 | **AI invoice creation** (photo/text → structured invoice; manual fallback) | Jev extraction cascade + citation check |
| F3 | Invoice hosting + share (WhatsApp/link/QR) | — |
| F4 | **Buyer checkout: USD card / Apple Pay / Google Pay** | Payaza Checkout SDK + Payment Links + Card API |
| F5 | **Buyer checkout: KES/UGX/TZS MoMo** (regional invoices) | Payaza MoMo process-collection |
| F6 | Webhook-driven transaction state machine + status-query fallback | Webhooks (HMAC verified) + status APIs |
| F7 | **KES payout to M-Pesa/bank** (auto + manual, confirm-gated) | Payaza Transfers (mobile_money/kepss) |
| F8 | **Fee/FX transparency panel + settlement ETA** | Payaza SLAs + fee fields from webhooks |
| F9 | Ledger/transactions DataTable + CSV export | — |
| F10 | Dashboard analytics (collected, pending, top buyers, corridors) | Chart |
| F11 | **Buyer risk composite + confidence-gated review** | Jev Nouls + composite scoring |
| F12 | Demo Mode (seeded fixtures + payload replay) | — |

### 8.2 V1 — pilot scope (weeks after event)
- Split settlements to agents/co-ops (F: J5) with statements · reminder engine with guard-
  railed drafts (J6) · buyer directory + repeat-buyer insights · PDF invoice branding ·
  WhatsApp bot invoice creation (Payaza Chat-and-Pay precedent) · subscriptions for service
  exporters · multi-user roles (owner/accountant) · Kiswahili UI toggle · auth-capture
  deposits for large orders.

### 8.3 V2 — scale
- EAC trader mode (P4): multi-currency balances view, UGX/TZS payouts to suppliers ·
  customs/documentation vault (CD1, invoices) for bank compliance · credit-scored ledgers →
  Payaza Boost lending referral · ERP/QuickBooks export · EUR/GBP collection when Payaza
  confirms rails (OpenAPI shows EUR accounts tag — research §4.7-5) · Rwanda when RWF lands.

### 8.4 Explicit non-features
Custodial wallets · crypto · FX speculation · consumer remittance · chargeback "insurance" ·
anything requiring our own payment license.

---

## 9. The AI Layer — Jev by Design (technical + why)

> Principle: **code owns the workflow; Jev supplies calibrated judgment.** No free-text
> generation touches money movement. Every judgment is logged with state, criteria,
> probabilities — auditable by design (research §6).

| Decision point | Primitive(s) | State given | Answer consumed as | Gate |
|---|---|---|---|---|
| Invoice extraction (photo/text) | Choice (select buyer among candidates + "new"), pre-parsed value selection for amounts/phones, Score (extraction quality) | source text, OCR text, buyer directory candidates, merchant history | typed invoice draft fields | quality <0.4 → Manual tab; per-field low confidence → amber highlight |
| Date resolution | Noul (is "next Friday" order-date vs due-date) + deterministic code resolution | message text, today's date, locale | due_date | always code-final |
| Firm-order vs enquiry | Noul | message text | invoice status `draft` vs `ready_to_send` | <0.5 → ask merchant |
| Buyer risk composite | **Nouls batched** (sanctions language; unusual amount vs history; jurisdiction risk; first-buyer; mismatch names) → weighted in code | invoice + buyer + history | risk 0–100 + reason chips | >60 → REVIEW (J7); >90 → hold |
| Payment-method routing | Choice (which rails to show) | invoice currency, buyer country, amount | checkout config | deterministic fallback table |
| Buyer message intent | Choice (promise/dispute/question/spam) | message + invoice | reminder flow routing | low conf → show raw to merchant |
| Draft guardrail | Noul (contains unsafe/inaccurate claims?) + citation Choice (each claim supported by ledger?) | draft + ledger facts | pass/review/block before send | block on P(unsafe)>0.3 |
| Payout anomaly | Noul (destination differs from usual pattern?) | payout + history | extra OTP confirm | always confirm >KES 100k |

**Batching:** all invoice-time judgments ship in **one** `systemOne` request (cookbook:
12.2× cheaper, 10× faster). **Latency budget:** <2s p95 for the extraction round-trip —
hidden behind a Skeleton review screen. **Cost model:** fractions of a cent per invoice vs.
USD 25+ wire fees — economically trivial (unit economics §11). **Fallbacks:** every Jev call
has a deterministic default (Manual form, default rail table, human review) — **the product
never blocks on AI availability.**

---

## 10. UX & Design (non-technical, exhaustive)

### 10.1 Design principles
1. **WhatsApp-native feel:** if Wanjiru can send a voice note, she can create an invoice.
2. **Honest money UX:** every number shown is a number we can defend — fees itemized, ETA
   ranges from real SLAs, rates with validity windows. No fake instant-FX theater.
3. **State clarity:** money has exactly one visible state at a time (Draft → Sent → Paid →
   Settling → On its way → In your M-Pesa), each with color + icon + plain language
   ("Money is moving — expect it by Thursday 16:00").
4. **AI shows its work:** amber fields = low confidence; reason chips = why flagged; one tap
   to fix or override (override logged).
5. **Mobile-first, desktop-capable:** merchant app is a responsive PWA; primary flows usable
   one-handed at 360px width; buyer pages <100KB initial payload on 3G.
6. **Bilingual microcopy:** English primary, Kiswahili secondary where it builds warmth
   ("Karibu", "Imefika! — Money arrived"). Numbers/currency always unambiguous (KES 1,234
   not 1,234/=).

### 10.2 Information architecture
```
kusanya.app
├── /                      Landing (public): hero, how-it-works, fee calculator, CTA
├── /login /signup         Auth (phone+OTP or email magic link)
├── /app                   Merchant shell (Sidebar):
│   ├── /app/dashboard         Overview: balances, recent activity, CTAs
│   ├── /app/invoices          DataTable: all invoices, status chips, search/filter
│   │   ├── /app/invoices/new      AI creation wizard (Snap | Paste | Manual)
│   │   └── /app/invoices/[id]     Detail: buyer, timeline, payments, splits, actions
│   ├── /app/buyers            Directory + per-buyer history & risk notes
│   ├── /app/payments          Ledger: collections, payouts, fees, FX, exports
│   ├── /app/partners          Split beneficiaries (agents/co-ops)
│   ├── /app/analytics         Charts: volume, corridors, cost saved, DSO
│   └── /app/settings          Profile, payout rails, KYC tier, AI preferences, API/Demo mode
├── /i/[token]             Buyer invoice page (public, branded, no auth)
├── /pay/[token]/result    Buyer post-payment result
└── /demo                  Guided Demo Mode walkthrough (judges!)
```

### 10.3 Key screens (UX spec summaries — full component lists in build.md §8)
- **Dashboard:** greeting + KES available balance card (primary), "in-flight" money card
  (settling/ETA progress), 3 quick actions (New invoice / Request payment / Withdraw),
  recent activity list, corridor sparkline chart. Empty state = onboarding checklist.
- **Invoice creation wizard:** step rail (Progress); Snap = camera dropzone + Skeleton
  processing ("Reading your note…"); Review = Field-composed form, amber low-confidence
  styling, source-snippet Tooltip on every AI field; Send = share Sheet (WhatsApp/copy/QR).
- **Invoice detail:** header (status Badge, amount, buyer), Tabs (Overview / Payments /
  Timeline / AI audit), sticky bottom action bar on mobile (Share / Remind / Mark manual).
- **Buyer invoice page:** merchant logo + name, line items table, total in buyer currency +
  KES-equivalent note, trust row ("Secured by Payaza · Card & Apple/Google Pay"), single
  primary CTA "Pay KES/USD …", post-payment receipt state. Fast, calm, no upsells.
- **Transparency panel (signature component):** waterfall breakdown — Gross USD 1,150.00 →
  Payaza fee −21.85 (1.9%) → FX 128.9 (rate + validity) → Partner split −34.50 → **Net to
  you KES 140,113** → ETA chip. Shown on every transaction; this panel *is* the brand.
- **Analytics:** Chart (Recharts via shadcn): stacked area collected/settled by week; bar by
  corridor; "fees saved vs. wire" counter card (the ROI story for judges).

### 10.4 States & accessibility
- Every list/table: loading (Skeleton), empty (Empty component with next-action), error
  (Alert + retry), offline banner (PWA). Money movements: optimistic UI never on balances —
  webhook-confirmed only.
- WCAG 2.1 AA: contrast-checked semantic tokens, focus rings, screen-reader labels on status
  chips ("Paid, 1,150 US dollars received 2:31 PM"), AlertDialog for destructive actions,
  reduced-motion respected. Forms: FieldGroup/Field with data-invalid + aria-invalid per
  shadcn rules.
- Notifications: in-app toasts (sonner) + WhatsApp/SMS (Africa's Talking v1) for paid/settled
  events — the persona trusts SMS over email.

### 10.5 Voice & copy
Confident, warm, concrete. "Get paid" not "Initiate collection". "Money is on its way" not
"Funds disbursement initiated". Error copy always = what happened + what to do + one tap to
do it ("M-Pesa number looks short — check and resend"). Swahili seasoning, never mixing
within a sentence.

---

## 11. Business Case (non-technical)

### 11.1 Market sizing 🟡 (verify before deck)
- Kenya exports goods+services ≈ USD 20B+/yr; SME/informal share of non-traditional exports
  large (crafts, agri-aggregators, digital services). If 50k SME exporters average USD 100k
  collected/yr → **USD 5B collectible volume**; at 1.5% take rate → **USD 75M revenue pool**.
  Beachhead: 1% penetration = 500 exporters × USD 100k = USD 50M TPV, USD 750k ARR.
- Payaza's angle: every Kusanya shilling rides their checkout + payout + split rails —
  incremental TPV and merchant depth for their Kenya expansion.

### 11.2 Revenue model
1. **Take rate:** 1.5% of collected volume (bundled platform fee; Payaza rail fees passed
   through + margin) — still ≤ half of wire+PayPal leakage → easy sell.
2. **Kusanya Pro:** KES 1,500/mo — subscriptions billing, multi-user, accounting exports,
   WhatsApp bot (powered by Payaza Subscriptions APIs — dogfooding their rail).
3. **Partner splits fee:** 0.25% on auto-split volume (agents pay for certainty).
4. Later: FX margin transparency premium tier; lending referral (Boost) revenue share.

### 11.3 Unit economics (per USD 1,000 invoice)
| Line | Amount |
|---|---|
| Buyer-side rail cost (card ~2.9–3.9% intl typical; negotiated PSP rates lower) 🟡 | ~USD 29 |
| Payout cost (KES momo) 🟡 | ~USD 0.3 |
| Jev AI judgments (batched per invoice) | <USD 0.01 |
| Infra + notifications | ~USD 0.05 |
| **Kusanya revenue (1.5% + pass-through)** | **USD 15 + pass-through** |
| Exporter net vs. status quo | **saves USD 10–50 and 2–9 days** |
*(Hackathon note: exact rail fees are Payaza commercial terms — the transparency panel
displays whatever the real numbers are; our margin is the 1.5%.)*

### 11.4 Why the transparency panel is the moat
Competitors hide fees in FX spreads. Kusanya's brand promise is **visible math** — the
panel (§10.3) converts Payaza's own webhook fee fields into a receipt-grade breakdown.
Trust is the product; the payments are the plumbing.

### 11.5 Go-to-market
1. **Pilot (the prize):** 5–10 Payaza-network merchants exporting agri/crafts; white-glove
   onboarding at Hackhouse; measure leakage-saved + time-to-settle (deck shows the metrics
   dashboard we already built).
2. **Agent-led growth:** every forwarding agent onboarded as split beneficiary brings their
   exporter book (P3 → P1 loop).
3. **Communities:** Kenya Export Promotion Agency events, AgriBusiness associations,
   craft co-ops, Hackhouse alumni; WhatsApp-first distribution (share invoice = share product).
4. **Content:** "fee saved" leaderboards (anonymized), exporter success stories.

---

## 12. Metrics & Success Criteria

| Layer | Metric | Demo-day target | Pilot target (90d) |
|---|---|---|---|
| Product | Invoice creation time (AI vs manual) | <90s vs 10min | <60s median |
| Product | Buyer checkout completion | ≥80% sandbox | ≥70% live |
| Product | Time-to-KES (USD invoice) | shown ETA honest | ≤ T+4 median |
| Business | Leakage saved per exporter/mo | computed in demo | ≥2% of volume |
| Business | Active exporters / TPV | demo fixtures | 10 / USD 50k |
| AI | Extraction field accuracy (review corrections) | instrumented | ≥90% fields untouched |
| AI | Risk-review precision (false holds) | audit trail shown | <5% |
| Trust | NPS of pilot exporters | — | ≥40 |

---

## 13. Compliance, Trust & Safety (pilot-credible)

1. **Licensing posture:** Kusanya is a **technology layer on Payaza's licensed rails** —
   Payaza is the regulated payment institution (CBN/BoG licensed; Kenya rails per their
   docs). We never custody funds; settlement flows through Payaza accounts. (This is why
   feasibility-in-months is honest, not hand-wavy.)
2. **KYC/KYB tiering:** Tier 1 (email/phone + ID, small limits) → Tier 2 (business docs,
   Payaza KYB alignment, full limits) — mirrors Payaza's own test/live gate.
3. **AML/CFT:** Jev composite risk screening on invoices/buyers (§9) + sanctions-language
   Nouls + audit trail of every judgment (probabilities + criteria + state hash) +
   hard-hold escalation. Sender blocks populated on every payout per Payaza AML fields.
   Sanctions lists integration (OpenSanctions) v1.
4. **PCI scope:** zero — card data only ever enters **Payaza's hosted checkout**; we never
   touch PAN (research §4.2).
5. **Data protection:** Kenya DPA 2019 (ODPC registration path), Nigeria NDPA on Payaza
   side; PII minimization (buyer pages collect only what payment needs); encrypted at rest;
   webhooks HMAC-SHA512 verified; AI logs retain judgments, not raw card data.
6. **Consumer protection:** refunds via Payaza refund API surfaced in invoice detail;
   dispute states in ledger; chargeback evidence export from audit trail.
7. **AI ethics:** AI drafts never auto-send to buyers; merchant approves (human-in-loop);
   overrides logged; no automated declines without merchant-visible reasons.

---

## 14. Judging-Criteria Alignment (self-audit against info.md §6)

| Criterion | How Kusanya scores | Evidence in demo |
|---|---|---|
| **1. Problem fit** | Named persona from the challenge text ("SME exporter… agriculture, crafts, digital services… expensive intermediaries") with quantified weekly pain (§2.1: 3–8% leakage, 3–10 days) — not generic fintech | Open with Wanjiru's week; fee-saved counter |
| **2. Use of Payaza infrastructure** | Six product areas structurally required: Checkout SDK, Payment Links, Card API (USD), MoMo collections (KES/UGX/TZS), Transfers (KES momo/kepss payouts), Split Settlements, + Webhooks/status/subscriptions. Flow is impossible without Payaza | Live sandbox money movement; rail badges on every ledger row |
| **3. Feasibility** | No license needed (Payaza holds them); pilot = 10 merchants from Payaza's own network; unit economics positive per invoice; AI cost <1¢ | Pilot ask slide; compliance posture §13 |
| **4. User experience** | Designed for P1's phone and literacy (§10): WhatsApp-native creation, SMS/WhatsApp notifications, Swahili microcopy, honest states, <3-min onboarding | Judge creates an invoice from a pasted WhatsApp message on stage |
| **5. Presentation** | 4-minute demo script with a story arc (§15), business case in three numbers (leakage %, days saved, take rate) | Rehearsed; deterministic Demo Mode fallback |

---

## 15. Demo Script (4 minutes, judged presentation)

> Cast: Presenter (PM) drives; Engineer has merchant app on phone-mirror + buyer laptop;
> third member runs the Payaza sandbox.

1. **(0:00–0:30) Hook — Wanjiru's week:** "This is a real order request." Paste actual
   WhatsApp text on screen. "Today this becomes a wire transfer she loses 5% and 6 days on."
2. **(0:30–1:15) Magic — AI invoice:** Snap/Paste → Jev extraction live → amber field fixed
   with one tap → invoice + Payaza payment link generated → shared to WhatsApp (QR shown).
   Callout: "Every AI field carries a probability; the audit trail is one tap away." (flash
   AI audit tab)
3. **(1:15–2:15) Money moves — buyer side:** Switch to buyer laptop (London persona): open
   invoice page → Payaza hosted checkout → test card (3DS test flow) → success. Flip back to
   merchant app: **webhook lands live** → status PAID → toast + SMS shown. "Real Payaza
   rails, sandbox keys — not a mock."
4. **(2:15–3:00) Trust — settlement:** Transparency panel walkthrough (gross → fee → FX →
   split → net KES → ETA). Trigger payout → OTP confirm → sandbox-funded M-Pesa payout →
   NIP_SUCCESS → "Imefika!" receipt. Show agent split statement line.
5. **(3:00–3:30) Risk story:** Show the REVIEW-state invoice with reason chips + audit log:
   "This is the screen a Payaza compliance officer would pilot against."
6. **(3:30–4:00) Business case + ask:** Three numbers (4%→1.5% leakage; 6 days→1; 1.5% take
   rate on a USD 5B beachhead). "We're asking Payaza for 10 pilot merchants — the product is
   already built for your rails." Close on corridor map: USD→KES live, UGX/TZS enabled,
   Rwanda on Payaza's roadmap.

**Fallback choreography:** if venue network fails → `/demo` Demo Mode replays recorded
webhooks with identical UI (flagged "demo data" chip — honesty preserved).

---

## 16. Pilot Pathway Proposal (for the top-team conversation)

1. **Cohort:** 5–10 Payaza-network merchants with export flows (Storefront sellers shipping
   abroad are ideal candidates — Payaza already has 10k+ of them).
2. **Success metrics (90 days):** TPV collected; leakage saved vs. prior method; time-to-
   settle; AI extraction accuracy; zero compliance incidents.
3. **What we need from Payaza:** live keys + KYB fast-track; Kenya MoMo collection enablement
   (the on-request gate); commercial fee schedule for the transparency panel; split-
   settlement KES-beneficiary confirmation; mentor hours at Hackhouse.
4. **What Payaza gets:** a vertical product activating checkout+links+payouts+splits for a
   new merchant segment; fraud-screened volume; a case study for their Kenya expansion;
   subscription-rail dogfooding (Kusanya Pro billed via Payaza Subscriptions).
5. **Moat & roadmap:** EAC trader mode (track-1 personas) is a toggle away once Uganda/
   Tanzania collections prove out; EUR when rails confirm; Rwanda when RWF lands.

---

## 17. Roadmap Summary

| Phase | When | Scope |
|---|---|---|
| **P0 — Tonight** | 26 Sept, by 23:59 EAT | Register team + submit idea text (from §1–2) + deck link (built from §15 script) |
| **P1 — Prototype** | Build window after registration | MVP F1–F12 on sandbox; Demo Mode; deck polish |
| **P2 — Event/demo** | Hackhouse Nairobi | Live sandbox demo; judge Q&A prep (compliance §13, economics §11) |
| **P3 — Pilot prep** | +2–6 weeks | Live keys, KYB, first 3 merchants, WhatsApp notifications, PDF invoices |
| **P4 — Pilot** | +2–3 months | 10 merchants, metrics dashboard, splits live, reminder engine |
| **P5 — Scale** | +6 months | EAC trader mode, subscriptions, bot, lending referral |

---

## 18. Risks & Mitigations (product-level; research §10 has technical)

| Risk | Mitigation |
|---|---|
| "Payment links are generic" perception (Jev generic-risk 0.45) | Lead with AI invoice pipeline + transparency panel + splits + risk engine — links are plumbing, never the headline |
| FX conversion mechanics unconfirmed (who converts USD→KES at what rate) | UX models honest ETAs and rate-validity windows; ask Payaza mentors day 1; panel displays actual settled amounts from webhooks, never promises |
| Buyer trust in a new invoice domain | Payaza-branded secure checkout ("Secured by Payaza"), HTTPS, merchant identity on page, receipt emails |
| Persona access for validation | Hackhouse community + exporter Facebook/WhatsApp groups; pilot merchants from Payaza network |
| Team execution risk on deadline | P0 checklist tonight; MVP scoped to F1–F12 only; Demo Mode guarantees a floor |

---

## 19. Submission Artifacts Checklist (tonight)

- [ ] Team assembled (3–5 members, roles from register form enum)
- [ ] Team name chosen (suggest product-aligned, e.g. "Kusanya" or team brand)
- [ ] **Deck** (8–10 slides from §15 script + §2 problem + §11 business case) uploaded → link
- [ ] **Idea text** (300–500 words distilled from §1, §2, §4.3, §14 — track #3 explicitly named)
- [ ] Register at https://hackathon.payaza.africa/register before **23:59 EAT**
- [ ] Email support@payaza.africa requesting Kenya/EAC sandbox collections access (R1)

> Engineering realization of everything above: **`docs/build.md`**.
