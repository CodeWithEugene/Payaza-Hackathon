# research.md — Deep Research Dossier: Borderless Kenya Hackathon

> Everything discovered during research, with sources. Compiled 26 September 2026.
> Companion docs: `info.md` (event facts) · `solution.md` (what we build) · `build.md` (how).
>
> **Confidence tags used below:**
> - ✅ **Verified** — extracted directly from a primary source fetched during research (URL given).
> - 🟡 **Reported** — from training-knowledge or secondary memory; directionally reliable, verify before publishing in slides.

---

## 1. Research Method & Source Log

Live-fetched and parsed on 26 Sept 2026 (all primary sources):

| Source | What was extracted |
|---|---|
| `https://hackathon.payaza.africa/` (full SSR HTML) | Complete challenge/criteria/prizes/FAQ copy, corridors, organizer list, ticker themes, countdown |
| `https://hackathon.payaza.africa/register` (full SSR HTML) | Exact submission form: fields, member roles enum, 3–5 member constraint, presentation-link requirement |
| `https://docs.payaza.africa/llms.txt` | Complete documentation map (89 entries: guides + API reference) |
| 57 doc pages fetched as Markdown (all guides + core api-reference) | Auth model, every product rail, request/response shapes, webhooks, error codes, test tooling, environment quirks |
| `https://docs.payaza.africa/openapi.json` (589 KB, **57 endpoint paths**) | Canonical endpoint list, currency frequency, tags incl. "EUR Accounts" |
| `https://hackhouse.africa/` | Organizer profile (venue, programs, scale) |
| `https://payaza.africa/` JS chunks (219 files, 3.2 MB, string-mined) | Company facts: licensing, offices, product suite, settlement SLAs, merchant scale, fraud taxonomy, terms |
| `https://blog.payaza.africa/` | Site map of payaza.africa subpages (company/pricing/collections/payout/checkout) |
| `https://docs.typesafe.ai/llms.txt` + `typesafe-ai` agent skill | Jev model: primitives, patterns, cookbooks, SDK surface |
| `https://ui.shadcn.com/llms.txt` + `shadcn` agent skill | Complete shadcn/ui component inventory, CLI, rules, theming model |
| Live Jev API calls via local `jev` CLI (`@typesafe-ai/sdk` 0.6.0) | Structured decision analysis: track selection, idea scoring, naming (raw outputs in §9) |

Web search was unavailable during research (provider balance exhausted) — market statistics in
§7 are therefore 🟡 knowledge-based and flagged for verification before they appear in slides.

---

## 2. Hackathon Site Analysis (technical + strategic)

- **Stack:** Nuxt 2 SSR + Tailwind 3.4.4, IBM Plex Mono + Inter, dark "terminal/fintech"
  aesthetic with green/orange/sky accent dots. Static content; countdown is client-rendered.
- **Structure:** single page with `#challenge`, `#criteria`, `#prizes`, `#faq` anchors + `/register`.
  No hidden rules pages exist — `info.md` is the complete public rule set. ✅
- **Strategic reading of the copy:**
  - "Build for the person who feels it every week" → judges want a **named persona with weekly,
    quantifiable pain**, not market-size abstractions.
  - "A slick demo that ignores the real user, or uses Payaza only on the surface, will not
    place" → explicit warning that **visual polish without rail depth loses**.
  - "Build on Payaza rails, not a mock" → the demo should move **real (sandbox) money** through
    Payaza APIs; mocked flows are detectable and penalized.
  - "Working prototype with a credible path to becoming a real product" → **pilot-credibility**
    (compliance, unit economics, ops) is a first-class judging dimension via "Feasibility".

---

## 3. Organizer Profiles

### 3.1 Payaza Africa Limited ✅ (from payaza.africa JS chunks + docs)
- **What it is:** pan-African payments company — collections, payouts, payment gateway,
  checkout, payment links, virtual accounts, storefront e-commerce, business loans ("Payaza
  Boost"), branches/sub-accounts, MPOS, and a WhatsApp "Chat and Pay" flow.
- **Licensing:** "Payaza Africa Limited is fully licensed by the **Central Bank of Nigeria**"
  and "fully licensed by the **Bank of Ghana**" (site copy). Terms also reference courts of
  Kenya, Tanzania, and East/West/Southern African regions → regulated or operational footprint
  across those markets.
- **Offices:** Lagos (301, Jide Oki, Victoria Island) · Accra (1, Norfo Close, North
  Dzorwulu; also Ghana Airport Cargo Center, KIA) · Kampala (P.O.Box 124516, Najeera II,
  Kira Division). Nairobi presence implied by the hackathon's Kenya rails focus.
- **Scale claim:** "Over **10,000 merchants** across Africa trusted Storefront by Payaza with
  their first online sale."
- **Settlement SLAs:** "settlement schedule starts from **T+1 on local collections**. **USD
  collections are between T+3 – T+5**." (Critical for our solution's cashflow UX — §7.4.)
- **API key format:** `PZ78-PKTEST-…` / `PZ78-SKLIVE-…` (key prefix "PZ78").
- **Fraud awareness (their own published taxonomy):** fake merchants, synthetic identities,
  dashboard takeover to divert settlements, transaction laundering. → A collections product
  that ships **calibrated fraud screening** aligns with Payaza's stated risk priorities.
- **Community:** developer Slack (payaza-community.slack.com), Discord, support@payaza.africa,
  integrationsupport@payaza.africa.

### 3.2 Hackhouse Africa (Nairobi) ✅ (hackhouse.africa)
- "Home to Africa's boldest builders" — coworking + residency + partner-program venue at
  **124 Manyani East Road, Nairobi**. 5,450+ builders supported, 400+ events, 40+ resident
  companies, 5 years (since Startinev, 2020).
- Programs: 12-week Residency (Spark: idea→product, KES 25k; Scale: live startup growth,
  KES 35k; **no equity taken**), Demo Days, partner hackathons (Red Bull Basement, US Embassy
  Nairobi, Aiducation International).
- **Read:** this audience values builder-credibility, shippable output, and demo days. The
  prize split "between Payaza and Hackhouse" means both orgs judge/participate.

### 3.3 Africa Tech Academy 🟡
- Backer only (logo on site, no link). Likely a training/edtech org; assume it adds judging
  presence or training support. No public site resolved during research (africatechacademy.com
  is a parked JS lander). Low materiality for our strategy.

---

## 4. Payaza Platform & API Deep-Dive ✅

All facts below from docs.payaza.africa pages fetched 26 Sept 2026 (guides + OpenAPI spec).

### 4.1 Environment & Authentication
- **Single platform, single base URL:** `https://api.payaza.africa/live/` — the `/live/`
  segment is a **fixed path prefix**, identical for test and live.
- **Environment switch is by header + key:** `X-TenantID: test | live`; keys generated per
  mode in dashboard (Settings → Developers). Test transactions are not processed/settled.
- **Auth header format:** `Authorization: Payaza <public API key Base64-encoded>` —
  **not `Bearer`**. #1 cause of 401s per docs.
- **Header matrix by API:**
  | API | Authorization | X-TenantID | X-ProductID |
  |---|---|---|---|
  | Card collections | `Payaza <b64>` | not required | not required |
  | MoMo/XOF/ZAR/SLE collections | `Payaza <b64>` | `test`/`live` | **`app` (required)** |
  | Apple Pay / Google Pay | `Payaza <b64>` | not required | not required |
  | Transfers (payouts) | `Payaza <b64>` | `test`/`live` | not required |
  | Virtual accounts | `Payaza <b64>` | not required | not required |
  | Sub-accounts | `Payaza <b64>` | `test`/`live` | not required |
  | Refunds & chargebacks | `Payaza <b64>` | not required | not required |
  | Account enquiry | `Payaza <b64>` | `test`/`live` | not required |
- **KYB:** required for live only; **test access works immediately after signup** — perfect
  for hackathon timeline.
- **Live transfers prerequisites:** funded account, server **IP whitelist**, 6-digit
  **transaction PIN** (no repeated/sequential digits), **PND lift by email** to support after
  PIN setup. Sandbox has none of these friction points.
- **Optional payout signing:** `X-Payaza-Signature` = HMAC-SHA512 of exact request body with
  secret key (activation via support).

### 4.2 Collections rails (buyer → merchant)
| Rail | Endpoint / mechanism | Currencies | Notes |
|---|---|---|---|
| **Web Checkout SDK** (hosted modal) | `payaza-web-sdk` npm or CDN `checkout-v2.payaza.africa/js/v1/bundle.js`; `PayazaCheckout.setup()` | NGN, GHS + docs examples; raw key as `merchant_key`, `connection_mode: Test/Live` | Handles card + bank transfer + mobile money in one hosted UI; `split_accounts` array supported at checkout; callbacks fire client-side (**must verify server-side**); `additional_details` metadata; virtual-account expiry config |
| **Card Charge API** | `POST /card/card_charge/` | **NGN and USD** ✅ | 3DS + non-3DS flows, PIN for NGN cards, `callback_url`, status query API, refunds |
| **Apple Pay / Google Pay** | `POST /merchant-collection/mobile_payment/initiate` | (per docs) | Server-initiated, confirm via webhook/status |
| **MoMo / XOF / ZAR collections** | `POST /subsidiary/collections/v1/process-collection` | **GHS, KES, UGX, TZS, XAF, XOF, ZAR, SLE, CDF, LRD, ZMW** | USSD prompt flow; `customer_bank_code` per network; status via `GET /subsidiary/collections/v1/check-status?transaction_reference=…&country_code=…`; **test-funding endpoint** for sandbox; XOF-Orange needs OTP step; ZAR redirects |
| **Virtual accounts** | `POST /merchant-collection/merchant/virtual_account/generate_virtual_account` | **NGN only** | Dynamic (30-min default) or static; not usable for Kenya flows |
| **Payment Links** | `POST /payment-link/merchant/create-payment-link` | **NGN, USD** ✅ (docs list `currency_code` "e.g. NGN, USD") | No-code hosted pay page at `business.payaza.africa/pay/<slug>`; fixed or open amount; `fee_bearer_type: Business|Customer`; collect name/email/phone toggles; redirect_url; logo; CRUD + per-link transactions API |
| **Subscriptions** | `/subscription/api/v1/*` | cards | Plans, enroll card, recurring billing, pause/resume/cancel/change-plan, invoices, charge-now/custom-charge, event audit trail |

**MoMo collection mechanics (the East-African core):** server calls process-collection with
customer phone in international format **without `+`** (KES/UGX/TZS = 12 digits, e.g.
`2547XXXXXXXX`); network sends USSD prompt; customer enters MoMo PIN; app confirms via
webhook or status query. **`response_code:"09" / PENDING` on initiation is the expected
success** — final outcome only from webhook/status. Kenya bank codes: Safaricom M-Pesa
(`SAFKEN` in docs example), Airtel Kenya; Uganda: MTN, Airtel; Tanzania: Vodacom, Airtel,
Tigo, Halopesa. Full code list is a linked Google Sheet. Collections are **never retried
automatically**; unique `transaction_reference` per attempt; wrong bank code fails silently
on some networks.
**Access gate:** "Collections to countries other than Nigeria are **available on request
only** — email support@payaza.africa." (Hackathon registration is presumably that request.)

### 4.3 Payout rails (merchant → beneficiary) — `POST /payout-receptor/payout`
| Currency | `transaction_type` | Rail |
|---|---|---|
| NGN | `nuban` | Nigerian bank account |
| GHS | `mobile_money` / `ghipss` | Ghana MoMo / bank |
| **UGX** | `mobile_money` | **Uganda MoMo payout** |
| **TZS** | `mobile_money` / `tiss` | **Tanzania MoMo / bank** |
| **KES** | `mobile_money` / `kepss` | **Kenya M-Pesa payout / Kenyan bank (KEPSS)** |
| XOF | `mobile_money` / `wave` | West Africa MoMo / Wave |
| XAF, ZMW, SLE | `mobile_money` | MoMo |
| ZAR | `RTC` | SA real-time clearing |

- Single **and bulk** payouts (bulk returns `batch_reference`).
- Sender block (`sender_name`, `sender_phone_number`, `sender_address` required) — AML-grade
  sender data per beneficiary.
- Account-name enquiry (pre-payout verification) exists for **NGN/GHS only**.
- Statuses: `TRANSACTION_INITIATED → NIP_SUCCESS | NIP_PENDING | NIP_FAILURE | ESCROW_SUCCESS`
  (escrow = deducted, reversible). Status query by `transaction_reference`; webhooks for
  success/failure; **no automatic retries**.
- Requires `account_reference` = `payazaAccountReference` of the **currency wallet being
  debited**, fetched from `GET /payaza-account/api/v1/mainaccounts/merchant/enquiry/main`
  (returns one object per currency with balance → **Payaza operates multi-currency wallet
  balances**; this is the "multi-currency" pillar's backbone).

### 4.4 Split Settlements ✅ (marketplace mechanic)
- Create split account (`POST /settlement/settlement/merchant/split-account`) → returns
  `code` (`SSA_…`); pass `split_accounts:[{code}]` in **Checkout SDK** transactions; Payaza
  auto-routes remainder to beneficiary bank account at settlement.
- **Semantics trap (docs emphasize):** `split_value` = **what the platform KEEPS**
  (PERCENTAGE 0–100 or FLAT amount); beneficiary gets the remainder. Multiple percentage
  splits do not combine — each defines a separate retained amount.
- CRUD: create/update/activate/deactivate/delete/fetch (paginated).
- Currently documented with NGN examples (beneficiary bank account + bank code) — for Kenya,
  beneficiary would be a KES bank account; MoMo beneficiary support not documented →
  **verify during hackathon API access**; design fallback = payout leg instead of split.

### 4.5 Webhooks ✅
- POST JSON to configured URL (dashboard: Settings → Developers → Webhooks; separate
  Live/Test URLs).
- **Security:** header `x-payaza-signature` = **HMAC-SHA512(raw body, secret key)** Base64 —
  verify before processing; also idempotency by `transaction_reference`.
- **Collection events:** `transaction_status: "Funds Received" | "Transaction Failed"`;
  payload includes `amount_received`, `transaction_fee`, `received_from` (payer name/number),
  `merchant_reference`, `channel` (`KENYA_COLLECTIONS`, `UGANDA_COLLECTIONS`,
  `TANZANIA_COLLECTIONS`, `Card`, `Apple Pay`, `Google Pay`, `VirtualAccount`, …),
  `currency_code` (docs list incl. **USDT, USDC** alongside fiat), `customer` block,
  `request_amount`, `amount_validation: EXACT|UNDERPAYMENT|OVERPAYMENT`.
- **Transfer events:** `NIP_SUCCESS`/`NIP_FAILURE`, `sent_to` block, `is_reversed`, fee,
  currency/country.

### 4.6 Response-code convention
- Collections: `00` SUCCESS · `06/96` FAILED · `09` PENDING. Transfers: HTTP-style 200 +
  `transaction_status:"09"` initiated. Errors guide lists merchant-facing error taxonomy.
  → Our integration layer must normalize three different response dialects (collections,
  payouts, checkout callback) into one internal transaction state machine.

### 4.7 Capability gaps & quirks that shape the solution ✅
1. **No RWF anywhere** (collections or payouts; `RWF` appears 0× in OpenAPI). The site's
   KES→RWF corridor cannot be built natively on documented Payaza rails → **avoid Rwanda-
   dependent designs** (or treat as "coming soon" roadmap slide, not demo).
2. **No USD payout rail documented** — USD flows are inbound (card/checkout/payment links);
   outbound is African currencies. Corridor "World → NBO USD→KES" = **USD in, KES out** via
   Payaza wallet conversion, not USD transfer API.
3. **Virtual accounts are NGN-only** — irrelevant for a Kenya-first product.
4. **Account-name enquiry is NG/GH-only** — for KES payouts we must implement our own
   "confirm beneficiary" UX (typed-name echo + OTP to our user), since Payaza can't verify
   M-Pesa recipient names pre-payout.
5. **Card collections: NGN + USD only** — a Kenyan exporter collecting in EUR/GBP needs
   payment links/checkout currency support confirmation (docs say links support "NGN, USD";
   OpenAPI tags mention **EUR Accounts** sub-accounts → EUR capability exists somewhere;
   verify with Payaza during event).
6. **Non-Nigeria collections on-request** — assume sandbox Kenya MoMo access is granted to
   registered teams (FAQ promises it); test immediately after registration.
7. **OpenAPI spec lags the guides** (spec examples are NGN-heavy; KES appears once) — trust
   the guides; verify shapes against sandbox responses during build.
8. **Settlement SLAs differ by currency** (T+1 local, T+3–5 USD) → product UX must model
   "pending settlement" states honestly; this is a differentiator vs. naive demos.
9. **Web checkout callbacks are client-side** — docs explicitly warn to verify server-side
   via status query/webhook. Our design treats the callback as a hint, never as truth.
10. **No automatic retries anywhere** — our backend owns retry/idempotency with unique refs.

### 4.8 Sandbox & demo tooling ✅
- Test mode: `X-TenantID: test` + test keys; checkout `connection_mode: "Test"`.
- **Test card suite** (guides/testcards): approvals, declines, 3DS flows.
- **MoMo test funding endpoint:** `POST /merchant-collection/payaza/virtual_account/fund_test_virtual_account` (sandbox collections) and a MoMo-collections "Test Account Funding"
  endpoint — lets us **simulate a customer approving a USSD prompt** in demos. XOF test OTP
  `4567` documented. This makes a **live end-to-end money-movement demo possible** without
  real funds — directly serving "Build on Payaza rails, not a mock."
- No IP whitelisting/PIN in test → zero ops friction on demo day.

---

## 5. Rail × Corridor Fit Matrix (the decisive analysis)

Mapping the site's four corridors onto documented Payaza rails:

| Corridor | Collection rail (in) | Payout rail (out) | Native support |
|---|---|---|---|
| NBO→KLA (KES→UGX) | KES M-Pesa/Airtel MoMo · KES card | UGX `mobile_money` (MTN/Airtel) | ✅ Full |
| NBO→DAR (KES→TZS) | KES MoMo | TZS `mobile_money` + `tiss` bank | ✅ Full |
| NBO→KGL (KES→RWF) | KES MoMo | — | ❌ **No RWF rail** |
| World→NBO (USD→KES) | **USD card / payment links / checkout (intl cards, Apple/Google Pay)** | KES `mobile_money` (M-Pesa) + `kepss` bank | ✅ Full (USD in, KES out) |

**Conclusion:** the two fully-supported corridors are **EAC momo (UGX/TZS)** and
**World→NBO (USD→KES)**. A product that serves the **USD→KES exporter corridor with an EAC
momo expansion** rides 100% documented rails — no mocks, no Rwanda gap.

Per-track rail fit:
| Track | Rails it would use | Native coverage |
|---|---|---|
| 1 · EAC trade | KES/UGX/TZS momo collections + UGX/TZS/KES payouts + splits | ✅ (minus Rwanda) |
| 2 · Gig/creator | USD card/links in → KES momo out (+subscriptions for SaaS fees) | ✅ |
| 3 · SME/exporter collections | USD card/Apple-Google Pay/links in → KES momo/kepss out + splits + EAC momo in | ✅ **best overall coverage** |
| 4 · MoMo interop | KES momo in ⇄ intl card out | ⚠️ partial (intl payouts undocumented) |
| 5 · Remittance | USD card in → KES momo out | ✅ (but crowded; see §9) |

Track 3 uniquely exercises **all three named pillars** — Checkout (intl buyers pay),
Settlement (KES to M-Pesa/bank + splits to agents), Multi-currency (USD price → KES settle,
UGX/TZS expansion) — in one coherent merchant story.

---

## 6. TypeSafe / Jev Research ✅

### 6.1 What Jev is
- **Jev** is TypeSafe's flagship **System One** model: fast, calibrated, **typed judgments**
  (not text generation). You send **state** (any JSON/text context) + **questions**; it
  returns answers with **probabilities and confidence** that code consumes directly.
- Local install confirmed: `jev` CLI at `~/.local/bin/jev`, `@typesafe-ai/sdk` 0.6.0 (npm
  global) + `typesafe-sdk` 0.7.0 (pip). API key present in shell profile; CLI tested live
  (401 → fixed quoting → 200 OK).
- Docs: https://docs.typesafe.ai (llms.txt fetched; SDK/API/primitive pages mapped).

### 6.2 The three primitives
| Primitive | Returns | Use when |
|---|---|---|
| **Choice** | selected option + probability per option + confidence | exactly one of a defined set (routing, classification, selection) |
| **Noul** | P(yes) for a stated condition | whether a condition holds (flags, gates); one per label when several may apply |
| **Score** | probability-weighted position on ordered descriptive levels | degree along a dimension (severity, quality, urgency); comparable per-item scores → ranking |

Design rules (from skill + docs): one narrow coherent judgment per question; put all meaning
in instructions/criteria (question IDs are never sent to the model); give each question
sufficient named-JSON state; batch independent questions in **one request** (cookbook
measured 12.2× cheaper, 10× faster vs. serial); thresholds belong in code, judgments stay
raw and reusable; low confidence ≠ wrong — gate actions on confidence where consequences
matter ("confidence-gated routing" pattern).

### 6.3 Patterns/cookbooks directly applicable to this hackathon
| Pattern/cookbook | Application in our product |
|---|---|
| **Pre-parsed value extraction** (regex candidates + Jev selects span) | Extract amounts, phone numbers, buyer names, currency from messy WhatsApp/SMS/email order texts — code finds candidates, Jev picks the intended one → no hallucinated numbers |
| **SDE cascade** (mini → verify → reasoning) | Invoice-photo → structured invoice with cheap verify pass; escalate low-confidence to human review |
| **Composite scoring** | Buyer/order **risk score** = weighted Nouls (sanctions-language hit, first-time buyer, over-invoice amount, odd jurisdiction…) with weights owned in code — auditable AML-style screening |
| **Confidence-gated routing** | Auto-approve payout vs. require merchant confirmation vs. hold for review |
| **Intent routing** | Classify an inbound buyer message (payment promise / dispute / new order / spam) → route to reminders, dispute flow, invoice draft |
| **Function calling** | "Send the invoice for 500 kilos of macadamia to Susan in London" → typed `createInvoice(...)` arguments |
| **LLM guardrails** | Screen any AI-drafted reminder email before send (pass/review/block) |
| **Citation check** | Verify AI-drafted invoice line items against the source text/photo before presenting |
| **Date extraction** | Due dates from "pay within two weeks" style phrasing, resolved deterministically in code |

### 6.4 Why Jev (vs. a generic LLM) is the right AI story for judges
1. **Typed + calibrated:** payments need decisions with probabilities, not prose; Jev's
   outputs slot straight into ledger state machines.
2. **Cheap + fast:** System One judgments are small-model calls; batched questions keep a
   5-judgment invoice pipeline well under a second-class LLM cost — feasible per-transaction
   economics for SME-sized invoices (see unit economics in `solution.md`).
3. **Auditable compliance:** every flag has a probability + the exact criteria — a real story
   for the pilot conversation (AML/KYC reviewers demand explainability).
4. **Differentiation:** most hackathon teams will bolt on a chatbot; **calibrated decision
   primitives inside a payments pipeline** is a genuinely novel, defensible use of AI that
   matches Payaza's published fraud concerns (§3.1).
5. It's **already installed and proven working** in this environment (used for §9 decisions).

---

## 7. Market & Domain Research (Kenya/EAC cross-border payments)

> 🟡 This entire section is knowledge-based (web search was down during research).
> Every number must be re-verified before it appears in the submission deck.
> Directions and mechanisms are solid; exact figures are approximate.

### 7.1 Kenya's exporter base (Track 3 persona)
- Kenya's exports are dominated by **horticulture (cut flowers ~USD 0.7–1.0B/yr, vegetables,
  fruit), tea (~USD 1.4–2B/yr), coffee, textiles/apparel (EPZ), and increasingly digital
  services**. Smallholder farmers and small aggregators/SMEs sit under large brokers.
- **Small exporters** (crafts — soapstone, baskets, wood; agri-produce aggregators; digital
  agencies) typically invoice by WhatsApp/email, get paid by **bank wire (SWIFT)** or
  **PayPal/Wise/WorldFirst**, and lose **3–8% in fees + FX spread** plus **3–10 business days**
  of float. SWIFT wires to Kenyan SME bank accounts often cost the sender USD 25–45 and the
  receiver intermediary deductions; banks apply poor FX rates on arrival.
- PayPal→Kenya historically required third-party withdrawal services (e.g., via Thunes) with
  multi-day holds and ~5% fees — a widely complained-about friction for digital-service
  exporters.
- **Informality:** many SME exporters lack documentation to open merchant accounts with
  global PSPs (Stripe does not serve Kenya-registered SMEs natively) → they depend on
  intermediaries, exactly as the challenge text says: "struggle to collect from international
  buyers without expensive intermediaries."

### 7.2 EAC trade context (Track 1 adjacency)
- Intra-EAC trade ≈ **USD 10–11B/yr**; Kenya is the largest exporter within the bloc
  (≈ USD 3B+ to EAC partners). One-stop border posts (Busia, Malaba, Namanga, Rusumo) have
  cut transit times, but **payment friction persists**: traders settle via cash, bus
  conductors, or money-transfer shops; forex bureaus at borders price spreads of 3–6%.
- **Informal cross-border trade (ICBT)** is 2–4× formal flows in some estimates, dominated by
  women traders; licensing/permit patchwork (EAC simplified trade regime helps small volumes).
- Mobile money is the domestic default: **M-Pesa ~32M+ Kenyan customers, >KES 5T transacted
  annually**; Uganda: MTN MoMo/Airtel Money; Tanzania: M-Pesa/Tigopesa/Airtel/Halotel.
  Cross-border MoMo interop exists but is limited/expensive (e.g., M-Pesa Global).

### 7.3 Remittances & diaspora (Track 5 context)
- Diaspora remittances are **Kenya's largest FX source (~USD 4–4.5B/yr, >tea or tourism)**.
- World Bank *Remittance Prices Worldwide*: sending to Sub-Saharan Africa costs **~7–8% on
  average** (vs. UN SDG target of 3%); Kenya corridors are better (~5–6%) but still double
  the target. Digital players (WorldRemit, Remitly, Sendwave, Chipper) compressed fees on
  USD→KES to ~1–4% + FX margin — **Track 5 is the most crowded, least differentiated space**
  for a hackathon (Jev agreed: 81% "generic" probability, §9).

### 7.4 FX & settlement reality
- KES has been volatile (sharp 2023–24 depreciation ~20%+, partial recovery); exporters
  pricing in USD face real quote-validity risk → **quote expiry windows** (15–60 min) are
  industry practice; our UX must show locked-rate windows honestly.
- Payaza's own SLA: T+1 local settlement, T+3–5 USD — the product must display **expected
  settlement dates per rail**, turning a constraint into trust ("you'll see KES on M-Pesa by
  Thursday") rather than pretending instant FX magic.

### 7.5 Regulatory frame (feasibility story for judges)
- Kenya: **Central Bank of Kenya** regulates payments (National Payment Systems Act 2011);
  M-Pesa is Safaricom's; a PSP needs CBK licensing **or partnership with a licensed provider
  (Payaza is exactly that partner)** → our product is a **software layer on licensed rails**,
  which is why it's pilot-feasible in months without our own license.
- Data: **Kenya Data Protection Act 2019** (ODPC registration for data controllers); Nigeria
  NDPA/NDPC applies to Payaza side. Our compliance posture: minimize PII, hosted checkout
  (PAN never touches our servers → **PCI-DSS scope avoided**), audit logs for AI decisions.
- AML: Proceeds of Crime & Anti-Money Laundering Act (POCAMLA, Kenya); export documentation
  (CD1/customs entries) matters at scale; SME invoices <USD 5k are low-scrutiny but still
  need sanctions-language screening → Jev composite risk score (§6.3) is the credible story.

### 7.6 Competitive landscape
| Player | Model | Gap we exploit |
|---|---|---|
| PayPal/Wise/Payoneer (🟡) | Global wallets, card-funded | Kenya withdrawal friction, no M-Pesa-native settlement, weak invoicing for informal SMEs, poor EAC momo |
| Stripe (🟡) | Not available to Kenya-registered SMEs natively | — |
| Flutterwave/Chipper (🟡) | Pan-African gateway/wallet | Broad but not exporter-workflow-specific; invoicing + AI extraction not core |
| M-Pesa Global / Safaricom (🟡) | Diaspora→M-Pesa | Inbound remittance only; no merchant invoicing/collections for exporters |
| Banks (SWIFT) (🟡) | Wire transfers | USD 25–45 fees, days of delay, paperwork |
| Pesapal/Flutterwave Store etc. (🟡) | Local checkout | Domestic-focused; weak USD-in→KES-out exporter flow |
| **Kusanya (us)** | Invoice + payment-link collections for Kenyan SME exporters: USD card/wallet in → KES M-Pesa/bank out, EAC momo expansion, AI invoice creation, split-settled agents | Workflow depth on the exact persona the challenge names, on Payaza rails, with calibrated AI |

---

## 8. shadcn/ui Research ✅ (for build.md compliance)

### 8.1 What it is
- Not a component library you install — **code you copy into your repo** via CLI
  (`npx shadcn@latest add …`), built on TypeScript + Tailwind CSS + Radix UI primitives
  (newer versions support Base UI; `components.json` `base` field decides). Frameworks:
  Next.js, Vite, Remix, Astro, Laravel, React Router, TanStack. "Open Code, Composition,
  Beautiful Defaults, AI-Ready."
- **Presets/themes:** named presets `nova`, `vega`, `maia`, `lyra`, `mira`, `luma` + encoded
  preset codes; theming via CSS variables (Tailwind v4 uses `@theme inline` in the global CSS
  file; v3 uses `tailwind.config.js`).

### 8.2 Component inventory (full, from llms.txt) — mapped to our product
- **Form & input:** Field, Button, Button Group, Input, Input Group, Input OTP, Textarea,
  Checkbox, Radio Group, Select, Native Select, Switch, Slider, Calendar, Date Picker,
  Combobox, Label → invoice forms, buyer capture, OTP-style PIN entry, due-date pickers.
- **Layout & nav:** Accordion, Breadcrumb, Navigation Menu, Sidebar, Tabs, Separator,
  Scroll Area, Resizable → dashboard shell (Sidebar), invoice detail (Tabs), FAQ (Accordion).
- **Overlays:** Dialog, Alert Dialog, Sheet, Drawer, Popover, Tooltip, Hover Card,
  Context Menu, Dropdown Menu, Menubar, Command → payout confirmation (AlertDialog),
  mobile invoice drawer, share-link popover, cmd-K palette (Command).
- **Feedback:** Alert, Toast (sonner), Progress, Spinner, Skeleton, Badge, Empty →
  transaction states, webhook-driven toasts, settlement progress, empty states everywhere.
- **Display:** Avatar, Card, Table, **Data Table** (sort/filter/paginate), **Chart**
  (Recharts wrapper), Carousel, Aspect Ratio, Typography, Item, Kbd → transactions table,
  FX/earnings charts, buyer avatars.
- **Misc:** Collapsible, Toggle, Toggle Group, Pagination, Direction (RTL).
- **Chat primitives** (MessageScroller, Message, Bubble, Attachment, Marker) → the
  AI-invoice-assistant conversation UI composes from these, per skill rules (never
  hand-rolled bubbles).

### 8.3 Non-negotiable rules (from the loaded shadcn skill; enforced in build.md)
1. Semantic colors only (`bg-primary`, `text-muted-foreground`) — never raw `bg-blue-500`;
   no manual `dark:` overrides.
2. `className` for **layout** only; never restyle component colors/typography; use built-in
   `variant`/`size` first.
3. Spacing with `flex` + `gap-*` — **never `space-x-*`/`space-y-*`**; `size-*` for equal
   w/h; `truncate` shorthand; `cn()` for conditionals; no manual z-index on overlays.
4. Forms: **`FieldGroup` + `Field`** composition (never raw div+label), `data-invalid` on
   Field + `aria-invalid` on control, `InputGroup` for affixed inputs, `ToggleGroup` for
   2–7 option sets, `FieldSet`+`FieldLegend` for grouped choices.
5. Structure: items inside groups (`SelectItem`→`SelectGroup`), `asChild`/`render` for custom
   triggers per base, Dialog/Sheet/Drawer always have Titles (sr-only if hidden), full Card
   composition (Header/Title/Description/Content/Footer), Button loading = `Spinner` +
   `data-icon` + `disabled` (no `isPending` prop), TabsTrigger inside TabsList, Avatar needs
   AvatarFallback.
6. Use components not markup: `Alert` for callouts, `Empty` for empty states, `Separator`
   not `<hr>`, `Skeleton` not pulse-divs, `Badge` not styled spans, sonner/Radix `toast()`
   per project base.
7. Icons: `data-icon="inline-start|inline-end"` inside Buttons, **no sizing classes on
   icons inside components**, pass icon objects not strings.
8. Workflow: `npx shadcn@latest info` for project context; `docs <component>` before use;
   `search` before custom; review every added file; never guess registries; never
   `--overwrite` without approval.

### 8.4 Theming decision (for build.md)
- Tailwind v4 + Next.js 15 + `base` or `radix` per CLI default at init time; define brand
  tokens in the global CSS file (`@theme inline`): primary = deep export-green, accent =
  "money-movement" lime (a subtle nod to Payaza's `#A8FC84` CTA color without copying),
  full dark mode via semantic tokens. Charts use shadcn `Chart` with `ChartConfig` color
  tokens (never hardcoded hex in series).

---

## 9. Jev-Driven Decision Analysis (raw outputs + interpretation)

We used the installed Jev CLI as a **calibrated decision instrument** at three forks. Full
state files preserved in repo history discussion; outputs below verbatim.

### 9.1 Fork 1 — Which track? (Choice ×4 framings)
State: full hackathon context + verified rail facts (§4–5) + team profile.

| Question | Winner | Probabilities (top-2) | Confidence |
|---|---|---|---|
| Best overall chance of winning | **track3 (SME/exporter collections)** | t3 0.49, t1 0.30 | 0.36 |
| Best fit to documented Payaza rails | **track1 (EAC trade)** | t1 0.84, t4 0.11 | 0.79 |
| Easiest to demo in sandbox | **track3** | t3 0.31, t2 0.27 | 0.13 |
| Best fit for Payaza pilot pathway | **track3** | t3 0.81, t1 0.16 | 0.76 |

**Interpretation:** track3 wins 3 of 4 framings, including the two high-confidence ones on
commercial fit (pilot 0.76) and overall (relative). Track1's rail-fit win (0.84/0.79) is
explained by §5: tracks 1 & 3 share the same rails — the resolution is **track3 as the
submitted problem, with EAC multi-market momo collections built in as the expansion** so
track-1 rail depth is captured inside a track-3 story. Track5 (remittance) and track2
scored near-zero on overall/pilot — consistent with crowding (§7.3) and thinner merchant
value for Payaza's pilot prize.

### 9.2 Fork 2 — Which product concept? (Choice + Score ×4 ideas ×4 criteria + Noul ×4)
Ideas: **A "ExportFlow/Kusanya"** (track3 exporter collections, full spec in `solution.md`)
· **B "TraderHub"** (track1 multi-currency EAC trader dashboard) · **C "ShieldPay"** (track2
freelancer FX shield) · **D "DiasporaDirect"** (track5 remittance).

Scores (0 weak → 3 outstanding; probability-weighted):

| Criterion | A Kusanya | B TraderHub | C ShieldPay | D Diaspora |
|---|---|---|---|---|
| Problem fit | **2.57** | 2.44 | 1.11 | 1.18 |
| Use of Payaza | **2.90** (conf 0.90) | 2.35 | 1.59 | 1.77 |
| Feasibility | **2.03** | 1.90 | 1.97 | 1.94 |
| UX & demo impact | **2.32** | 1.69 | 1.40 | 1.36 |
| P(perceived generic) ↓better | **0.45** | 0.61 | 0.80 | 0.81 |
| **P(win) — head-to-head Choice** | **0.59** | 0.41 | 0.00 | 0.00 |

**Interpretation:** A wins **every dimension**, with the standout being Payaza-infrastructure
use at 2.90/3 with 0.90 confidence (nine-tenths probability mass on "outstanding") — because
A exercises checkout/links/card + KES momo/kepss payouts + splits + subscriptions +
webhooks in one merchant story. C and D were eliminated outright (0.00 head-to-head) —
their genericness probabilities (0.80/0.81) mean they'd blend into the pile. A's residual
0.45 generic-risk is the actionable warning: **the moat is the AI invoice pipeline, the
settlement-transparency UX, and the agent split-settlement story — not "we made a payment
link."** Those must be front-and-center in deck and demo.

### 9.3 Fork 3 — Name (Choice)
Candidates: Kusanya (Swahili "to collect/gather"), SokoLink, Fanaka, ExportFlow, LimaPay.
**Winner: `kusanya` — P 0.56** (SokoLink 0.35, LimaPay 0.06, ExportFlow 0.02, Fanaka 0.01),
confidence 0.44. Rationale encoded in criteria: fits Kenyan audience, credible to fintech
judges, avoids known brand clashes (PesaLink, M-Pesa, Mavuno Church).
→ Product name: **Kusanya** ("to collect"). Tagline direction: *"Get paid for what you
ship — wherever your buyer is."*

---

## 10. Risks, Constraints, Open Questions

| # | Risk/Question | Impact | Mitigation / action |
|---|---|---|---|
| R1 | Kenya MoMo collections "on request only" — sandbox access timing | Demo can't show KES collections | Email support@payaza.africa immediately after registering; fallback demo = USD card checkout + KES payout legs (both sandbox-ready) |
| R2 | Split settlements documented NGN-first | Agent-payout feature may not work on KES beneficiary | Verify in sandbox; fallback = automatic **payout leg** (`mobile_money` KES) triggered by our webhook instead of native split |
| R3 | USD→KES conversion mechanics (rate source, who converts, T+3–5 USD settlement) | FX promise could be wrong | Model quotes with explicit validity window + "settlement ETA per Payaza SLA" copy; ask Payaza mentors at event for the conversion flow; never display a fake instant rate |
| R4 | No RWF rail | Track-1-adjacent promises break | Rwanda appears only as roadmap slide, never in demo |
| R5 | Webhook delivery to Vercel in demo venue (network) | Live demo stalls | Polling fallback (status-query every 5s while pending) is built-in anyway; offline **Demo Mode** fixture replays recorded payloads |
| R6 | KYB needed for live keys | No real-money demo | Demo on `X-TenantID: test` + test funding endpoints; that satisfies "on Payaza rails, not a mock" (sandbox is Payaza's real API) |
| R7 | Presentation link due tonight | Disqualification | Deck (or Loom video) built from `solution.md` §17 script — highest-priority artifact after this doc |
| R8 | Jev latency/cost in live pipeline | Demo slowness | Batch all invoice questions in ONE request (12.2× cheaper per cookbook); precompute demo-invoice judgments in Demo Mode |
| R9 | Team size ≥3 enforced | Registration blocked | Recruit 3rd–5th member before 11:59 PM EAT today; roles from the form's enum |
| R10 | Figures in §7 are 🟡 | Deck credibility | Verify each stat against World Bank/CBK/KNA sources before submission; the deck cites only verified numbers |

---

## 11. Final Decisions (carried into solution.md)

1. **Track:** #3 — SME and exporter collections. (Jev: best overall 0.49; best pilot 0.81.)
2. **Product:** **Kusanya** — invoice-first international collections for Kenyan SME
   exporters: buyers pay in USD by card/Apple Pay/Google Pay via Payaza checkout or payment
   links (and in UGX/TZS/KES via MoMo for regional buyers); Kusanya settles to the exporter's
   M-Pesa or bank account in KES with total fee/FX transparency; AI (Jev) turns a photo or
   WhatsApp message into a professional invoice, screens buyer risk with calibrated
   probabilities, and drafts follow-ups; forwarding agents/commission partners get paid
   automatically via split settlement. (Jev: wins every scored criterion; P(win)=0.59 vs
   runner-up 0.41.)
3. **AI:** TypeSafe Jev decision primitives inside the payment pipeline (extraction →
   composite risk → gated routing → guardrails), not a chatbot.
4. **UI:** Next.js + Tailwind + shadcn/ui exclusively, per §8 rules.
5. **Corridors demoed:** World→NBO (USD→KES) primary; NBO⇄EAC momo secondary. No Rwanda.
6. **Demo strategy:** live sandbox money movement (test card → webhook → KES payout via test
   funding) with a deterministic Demo-Mode fallback.

→ Full product design: `docs/solution.md`. Full engineering spec: `docs/build.md`.
