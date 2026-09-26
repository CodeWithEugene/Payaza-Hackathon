# build.md — Kusanya: Complete Build & Technical Specification

> Engineering source of truth for the Borderless Kenya hackathon build.
> Product context: `solution.md` · Research/evidence: `research.md` · Event facts: `info.md`.
>
> **UI law: shadcn/ui exclusively.** Every visual element is a shadcn/ui component composed
> per the official rules (semantic tokens, Field forms, gap-not-space, data-icon, no raw
> colors). No MUI/AntD/daisyUI. No hand-rolled markup where a component exists.
> Research baseline: `research.md` §8.

---

## 1. Guiding Principles

1. **Demo reliability > feature count.** Every flow has a deterministic Demo-Mode fallback.
   The judges' 4 minutes must never hang (solution.md §15).
2. **Server owns money.** All Payaza calls, keys, PINs, webhook secrets, and Jev calls live
   server-side. Client sees only our API + the Payaza hosted checkout modal.
3. **Webhook is truth, callback is a hint.** Client callbacks trigger a server-side status
   query; ledger state changes only from verified webhook or status-query confirmation
   (research.md §4.7-9).
4. **Idempotency everywhere.** Unique `transaction_reference` per attempt; webhook dedupe by
   (reference, status); retries never duplicate money movement.
5. **Typed end-to-end.** Zod schemas validate every external boundary (Payaza payloads,
   webhooks, Jev answers, forms). TypeScript strict mode; no `any` across boundaries.
6. **Honest states.** The UI never shows a balance or status that isn't webhook-confirmed.
7. **Audit by default.** Every AI judgment and money action appends to `audit_log`.

---

## 2. Stack Decisions

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript (strict)** | One deployable (Vercel), RSC for fast buyer pages, Route Handlers for webhooks/API, Server Actions for forms; team velocity |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (CLI-managed) | Required by UI law; v4 `@theme inline` tokens |
| shadcn base | **Radix** (`npx shadcn@latest init`, default preset `nova`, iconLibrary `lucide`) | Radix = sonner toasts + broadest component compat per shadcn skill rules |
| DB | **PostgreSQL (Neon serverless)** | Free tier, branchable for demo fixtures, serverless driver |
| ORM | **Drizzle ORM** + drizzle-kit migrations | Typed schema → Zod inference → shared types with client; fast hackathon iteration |
| Validation | **Zod v4** | One schema language for DB rows, API I/O, forms, webhook payloads |
| Server state | **TanStack Query v5** (client) + Route Handlers (API) | Polling fallback for pending transactions, cache invalidation on webhook SSE ping |
| Forms | **React Hook Form + shadcn Field components** | shadcn forms guide pairing; data-invalid/aria-invalid per rules |
| Auth | **better-auth** (email magic link + OTP; phone-OTP via Africa's Talking in v1) | Typed, fast to wire, session cookies; KYC tiers stored on `businesses` |
| Payments client | **`payaza-web-sdk`** (npm) on buyer pages; raw REST server-side | Official SDK = hosted checkout modal (card/bank/momo) with `split_accounts` support |
| AI | **`@typesafe-ai/sdk`** (server-only import) | Jev System One primitives; batched questions per research §6 |
| Email | **Resend** + react-email templates (invoice, receipt, reminder) | Fast, transactional |
| SMS/WhatsApp | **Africa's Talking** (SMS v1; WhatsApp v1.5) | Kenyan persona trusts SMS (solution §10.4) |
| Charts | **shadcn Chart** (Recharts wrapper) | UI law; ChartConfig tokens only |
| QR | `qrcode` (data URLs into shadcn components) | Invoice share sheet |
| E2E / unit | **Playwright** + **Vitest** | Demo-path regression; integration tests for webhook/state machine |
| Deploy | **Vercel** (app) + **Neon** (db) + Resend/AT managed | Public HTTPS URL for Payaza webhooks on day 1 |
| Package mgr | **pnpm** | Speed, strictness |
| Monitoring | Vercel Analytics + Axiom (structured logs of Payaza calls, redacted) | Demo-day visibility; audit trail |

**Explicitly rejected:** tRPC (extra ceremony; Route Handlers + Zod suffice), Supabase auth
(vendor lock vs better-auth flexibility), Prisma (heavier migrations than Drizzle for a
hackathon), Express/Fastify sidecar (two deploys = demo risk), Redux (TanStack Query owns
server state), raw CSS/styled-components (UI law).

---

## 3. Repository Structure

```
kusanya/
├── app/
│   ├── (public)/                      # landing, legal
│   │   ├── page.tsx                   # /  landing
│   │   └── fee-calculator/…
│   ├── (auth)/login/…  signup/…
│   ├── app/                           # merchant shell (auth-guarded layout w/ Sidebar)
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── invoices/
│   │   │   ├── page.tsx               # list (DataTable)
│   │   │   ├── new/page.tsx           # AI wizard
│   │   │   └── [id]/page.tsx          # detail
│   │   ├── buyers/page.tsx  buyers/[id]/page.tsx
│   │   ├── payments/page.tsx          # ledger
│   │   ├── partners/page.tsx          # split beneficiaries
│   │   ├── analytics/page.tsx
│   │   └── settings/…                 # tabs: profile, payout, kyb, ai, demo
│   ├── i/[token]/page.tsx             # buyer invoice page (public, RSC, fast)
│   ├── pay/[token]/result/page.tsx    # buyer post-payment
│   ├── demo/page.tsx                  # guided Demo Mode
│   └── api/
│       ├── webhooks/payaza/route.ts   # POST — HMAC-verified receiver
│       ├── invoices/route.ts          # GET list, POST create
│       ├── invoices/[id]/…            # GET, PATCH, /send, /remind, /cancel
│       ├── extract/route.ts           # POST — Jev extraction pipeline
│       ├── checkout/session/route.ts  # POST — create link/session, return client config
│       ├── collections/momo/route.ts  # POST — process-collection (KES/UGX/TZS)
│       ├── collections/status/route.ts# GET  — status-query proxy (polling fallback)
│       ├── payouts/route.ts           # POST create, GET list; /payouts/[id]/confirm
│       ├── partners/route.ts          # split beneficiary CRUD → Payaza split accounts
│       ├── account/route.ts           # balances/enquiry proxy
│       ├── banks/[currency]/route.ts  # bank codes proxy (cached)
│       ├── risk/[invoiceId]/route.ts  # GET risk assessment + audit
│       └── demo/replay/route.ts       # POST — Demo Mode webhook replay
├── components/
│   ├── ui/                            # shadcn-managed ONLY (npx shadcn add)
│   ├── layout/  (app-sidebar, topbar, mobile-nav)
│   ├── invoices/ (invoice-wizard, snap-dropzone, extraction-review, invoice-table,
│   │              invoice-preview, share-sheet, status-badge)
│   ├── money/   (transparency-panel, balance-card, payout-confirm-dialog, eta-chip,
│   │              fee-calculator)
│   ├── ai/      (confidence-field, reason-chips, audit-trail-viewer)
│   ├── charts/  (volume-chart, corridor-chart, savings-counter)
│   └── buyer/   (buyer-invoice-card, pay-button, receipt-view)
├── lib/
│   ├── payaza/ (client.ts, endpoints.ts, headers.ts, webhook-verify.ts,
│   │            state-machine.ts, references.ts, types.ts[zod], demo-payloads.ts)
│   ├── jev/    (client.ts, questions.ts, invoice-extraction.ts, risk-composite.ts,
│   │            intent.ts, guardrails.ts, types.ts)
│   ├── db/     (schema.ts, migrate.ts, client.ts)
│   ├── auth/   (config.ts, guards.ts)
│   ├── notify/ (sms.ts, whatsapp.ts, email.ts, templates/)
│   ├── money/  (fx.ts, fees.ts, format.ts)          # integer-minor-units math only
│   └── utils.ts (cn(), id gen: prefixed ULIDs — inv_, txn_, pzt_)
├── scripts/ (seed-demo.ts, replay-webhook.ts, sandbox-smoke.ts)
├── tests/   (unit/, integration/, e2e/demo-path.spec.ts)
├── drizzle/ (migrations)
├── public/  (logos, og-images, offline.svg)
├── .env.example · components.json · drizzle.config.ts · next.config.ts · playwright.config.ts
```

---

## 4. Environment Configuration (.env.example)

```bash
# --- App ---
NEXT_PUBLIC_APP_URL=https://kusanya.vercel.app
NODE_ENV=development

# --- Payaza (server-only, NEVER NEXT_PUBLIC_) ---
PAYAZA_PUBLIC_KEY=            # PZ78-PKTEST-… (raw; base64-encoded in lib/payaza/headers.ts)
PAYAZA_SECRET_KEY=            # for webhook HMAC + payout signature
PAYAZA_TENANT=test            # test | live
PAYAZA_PRODUCT_ID=app
PAYAZA_BASE_URL=https://api.payaza.africa/live
PAYAZA_CHECKOUT_MODE=Test     # SDK connection_mode: Test | Live
PAYAZA_PAYOUT_PIN=            # live only (6-digit, unique digits)
NEXT_PUBLIC_PAYAZA_MERCHANT_KEY=   # raw public key for Checkout SDK (public by design, test mode)

# --- TypeSafe Jev (server-only) ---
TYPESAFE_API_KEY=
TYPESAFE_MODEL=               # optional pin, else account default

# --- DB ---
DATABASE_URL=                 # Neon pooled connection string

# --- Auth ---
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# --- Notifications ---
RESEND_API_KEY=
AFRICASTALKING_USER=
AFRICASTALKING_KEY=

# --- Demo Mode ---
NEXT_PUBLIC_DEMO_MODE=false   # true → fixtures + webhook replay, Payaza calls stubbed
DEMO_SEED=wanjiru             # fixture set name
```

Key handling rules: `PAYAZA_SECRET_KEY`, `PAYAZA_PAYOUT_PIN`, `TYPESAFE_API_KEY`,
`DATABASE_URL`, `BETTER_AUTH_SECRET` are server-only (imported exclusively under `lib/`
server modules; eslint `no-restricted-imports` blocks them from client components). The
Checkout SDK merchant key is public-by-design (it gates a hosted modal; real auth = server
verification), and only the **test** key ships to the client during the hackathon.

---

## 5. Database Schema (Drizzle/Postgres)

Money columns: `numeric(18,2)` mapped to string in TS; all internal math in **minor units
(integers)** via `lib/money`. Statuses are PG enums mirroring `lib/payaza/state-machine.ts`.

```
users            id, email, phone, name, created_at                      (better-auth tables alongside)
businesses       id, user_id→users, name, slug, country='KE', kyc_tier(1|2),
                 settings jsonb {auto_payout, fee_bearer, language, notify_channels},
                 created_at
payout_rails     id, business_id→, rail(mpesa|kepss_bank), phone?, bank_code?, account_number?,
                 account_name?, verified bool, is_default bool
buyers           id, business_id→, kind(person|company), name, email?, phone?, country(iso2),
                 notes?, risk_flags jsonb, created_at
invoices         id (inv_…), business_id→, buyer_id→, number (human: KSN-2026-0001),
                 status enum(draft|ready|sent|partially_paid|paid|settling|settled|
                             paying_out|completed|failed|cancelled|review|on_hold),
                 currency (USD|KES|UGX|TZS), amount minor, fx_rate? numeric(12,6),
                 fx_quote_expires_at?, fee_bearer enum(business|customer),
                 due_at?, issued_at?, token (public, unique), payaza_link_id?,
                 payaza_link_url?, checkout_session_ref?, ai_meta jsonb
                 {source: snap|paste|manual, extraction_id, quality_score},
                 created_at, updated_at
invoice_items    id, invoice_id→, description, qty numeric, unit_price minor, currency, position
transactions     id (txn_…), business_id→, invoice_id?→, kind enum(collection|payout|refund|split),
                 direction(in|out), merchant_reference (unique, ours), payaza_reference?,
                 channel enum(card|apple_pay|google_pay|payment_link|momo_ke|momo_ug|momo_tz|
                              mpesa_payout|kepss_payout|virtual_account|manual),
                 currency, amount minor, fee minor?, net minor?, fx_rate?,
                 status enum(initialized|pending|completed|failed|reversed|escrow),
                 payaza_status_raw?, payload jsonb (redacted), occurred_at?, created_at
payouts          id, transaction_id→transactions (1:1), rail_id→payout_rails, beneficiary_name,
                 beneficiary_account (masked in UI), amount minor KES, confirmation
                 enum(not_required|otp_confirmed|dialog_confirmed), pin_used bool(server),
                 batch_reference?, status (mirrors txn)
split_beneficiaries id, business_id→, name, email?, account_no, bank_code?, rail(mpesa|bank),
                 split_type enum(PERCENTAGE|FLAT), split_value numeric,   # = OUR/merchant keep (Payaza semantics!)
                 payaza_split_code? (SSA_…), payaza_split_id?, active bool, fallback_payout_rail_id?
invoice_splits   id, invoice_id→, beneficiary_id→, share_pct?, expected_amount minor?, settled_amount minor?
risk_assessments id, invoice_id→, composite_score int 0-100, decision enum(pass|review|hold),
                 reasons jsonb [{label, probability, criterion}], jev_answer_id, created_at
ai_extractions   id, business_id→, source_type(snap|paste), source_text?, photo_url?,
                 jev_request jsonb, jev_response jsonb, quality numeric, duration_ms, created_at
webhook_events   id, event_kind, transaction_reference, signature_valid bool, dedupe_key (unique:
                 reference+status), payload jsonb, processed bool, error?, received_at
reminders        id, invoice_id→, channel(email|sms|whatsapp), scheduled_at, sent_at?,
                 drafted_by enum(template|ai), guardrail jsonb?, status
audit_log        id, actor(user_id|system|jev), action, entity_type, entity_id,
                 before jsonb?, after jsonb?, ai_ref?, created_at
```

Indexes: `transactions(merchant_reference) unique`, `transactions(business_id, created_at)`,
`webhook_events(dedupe_key) unique`, `invoices(token) unique`, `invoices(business_id, status)`.

---

## 6. Payaza Integration Layer

### 6.1 Client (`lib/payaza/client.ts`)
- Single `payazaFetch(path, {method, body, headers-profile})` wrapper:
  - `Authorization: Payaza ${base64(PAYAZA_PUBLIC_KEY)}` (encoded once at boot; **`Payaza`
    prefix, not Bearer** — research §4.1)
  - `X-TenantID: ${PAYAZA_TENANT}`; add `X-ProductID: app` **only** for
    `/subsidiary/*` collection endpoints (header matrix research §4.1)
  - JSON in/out; Zod-parse every response; timeout 15s; retry only idempotent GETs
    (2×, 500ms backoff). POSTs never auto-retry (Payaza doesn't retry either — app-level
    retry with a NEW `transaction_reference`).
  - Structured log (Axiom): path, status, response_code, reference — never keys/PAN.
- `DEMO_MODE=true` swaps the wrapper for `demo-payloads.ts` fixtures (recorded real sandbox
  responses, verbatim shapes).

### 6.2 Endpoint catalog (exact paths verified against OpenAPI + guides)

| Purpose | Method & path (base `https://api.payaza.africa/live`) | Used by |
|---|---|---|
| MoMo collection (KES/UGX/TZS) | `POST /subsidiary/collections/v1/process-collection` | buyer momo pay |
| Collection status | `GET /subsidiary/collections/v1/check-status?transaction_reference=…&country_code=…` | polling fallback |
| **Sandbox fund test collection** | `POST /subsidiary/funding/v1/process-collection` | Demo/tests (simulates customer approving USSD) |
| XOF OTP (n/a MVP) | `POST /subsidiary/collections/v1/process-otp` | future |
| Card charge (USD) | `POST /card/card_charge/` | server-initiated card (fallback when SDK n/a) |
| Card txn status | `GET /card/card_charge/transaction_status?transaction_reference=…` | confirmation |
| Apple/Google Pay | `POST /merchant-collection/mobile_payment/initiate` | buyer wallet pay |
| Create payment link | `POST /payment-link/merchant/create-payment-link` | invoice send |
| Fetch links / link txns | `GET /payment-link/merchant/fetch-payment-links?…` · `…/fetch-payment-link-transactions?link_id=…` | reconciliation |
| Update/activate/deactivate link | `PUT/GET …/update-payment-link?link_id=…` etc. | invoice edits |
| Merchant reference query | `GET /merchant-collection/transfer_notification_controller/merchant/transaction-query?merchant_reference=…` | checkout-callback verification |
| Payout (KES momo/kepss, UGX/TZS momo) | `POST /payout-receptor/payout` | settlement to exporter/agent |
| Payout status | `GET /payaza-account/api/v1/mainaccounts/merchant/transaction/{transaction_reference}` (also `…/transaction/status?transaction_reference=…`) | confirmation |
| Wallet balances / account refs | `GET /payaza-account/api/v1/mainaccounts/merchant/enquiry/main` | dashboard balances, `account_reference` for payouts |
| Bank codes | `GET /payaza-account/api/v1/mainaccounts/merchant/banks/{currency_code}` | payout setup (cached 24h) |
| Name enquiry (NG/GH only — unused KE) | `POST /payaza-account/api/v1/mainaccounts/merchant/provider/enquiry` | — |
| Split account CRUD | `POST/GET/PUT/DELETE /settlement/settlement/merchant/split-account[/{id}]` | partners |
| Refund | `POST /refund-chargeback/refund/merchant/api/refund` (+ history/status) | invoice refunds |
| Virtual account funding (sandbox, NGN VA) | `POST /merchant-collection/payaza/virtual_account/fund_test_virtual_account` | tests |

**Request shapes** (from guides, reproduced in `lib/payaza/types.ts` as Zod):
- process-collection: `{amount, customer_number (intl format, no '+': 2547XXXXXXXX),
  transaction_reference, transaction_description, customer_bank_code (KE: SAFKEN M-Pesa /
  Airtel per sheet), currency_code, customer_email, customer_first_name, customer_last_name,
  customer_phone_number, country_code}` → expect `response_code:"09"/PENDING` as *initiated*.
- payout: `{transaction_type: "mobile_money"|"kepss", service_payload:{payout_amount,
  transaction_pin (live only), account_reference (KES wallet's payazaAccountReference),
  currency:"KES", country:"KEN", payout_beneficiaries:[{credit_amount, account_number,
  account_name, bank_code, narration, transaction_reference, sender:{sender_name,
  sender_phone_number, sender_address}}]}}` → `TRANSACTION_INITIATED`.
- create-payment-link: `{payment_link_name (→ slug), payment_description, has_fixed_amount,
  payment_amount, country_code:"KEN", currency_code:"USD"|"KES", collect_customer_*,
  redirect_url: ${APP}/pay/[token]/result, custom_url, fee_bearer_type:"Business"|"Customer",
  payment_link_image}` → `{data:{id, link: https://business.payaza.africa/pay/<slug>}}`.

### 6.3 Checkout SDK usage (buyer pages, client component)
```ts
import PayazaCheckout from "payaza-web-sdk";
const checkout = new PayazaCheckout({
  merchant_key: process.env.NEXT_PUBLIC_PAYAZA_MERCHANT_KEY!,   // raw (NOT base64) for SDK
  connection_mode: process.env.PAYAZA_CHECKOUT_MODE as "Test" | "Live",
  checkout_amount: invoice.amountMajor,          // number, not string
  currency_code: invoice.currency,               // USD primary; KES/UGX/TZS regional
  email_address, first_name, last_name, phone_number,
  transaction_reference: txn.merchant_reference, // our unique ref, pre-created server-side
  additional_details: { invoice_id, kusanya_token: invoice.token },
  split_accounts: invoice.splits.length ? invoice.splits.map(s => ({ code: s.payaza_split_code! })) : undefined,
  callback: (res) => postCallback(res),          // → server verifies, never trusts
  onClose: () => setSheetOpen(false),
});
checkout.showPopup();
```
SDK errors mapped to shadcn `Alert` copy (research §4.2 table): invalid key / mode mismatch /
amount-not-numeric / invalid email.

### 6.4 Webhook receiver (`app/api/webhooks/payaza/route.ts`)
1. Read **raw body** (text) — HMAC must hash exact bytes.
2. Verify `x-payaza-signature`: `base64(HMAC-SHA512(rawBody, PAYAZA_SECRET_KEY))`,
   timing-safe compare. Invalid → 401 + audit log. (research §4.5)
3. Dedupe: insert `webhook_events` with `dedupe_key = reference:status`; unique violation → 200 (ack).
4. Classify payload (collection vs transfer shapes differ — `transaction_status` values
   `Funds Received|Transaction Failed` vs `NIP_SUCCESS|NIP_FAILURE|…`), Zod-parse.
5. Run **state machine transition** (§6.5) in a DB transaction; update invoice/transaction/
   payout; on collection-completed with `auto_payout` → enqueue payout job.
6. Notify (toast via SSE ping → TanStack Query invalidation; SMS/WhatsApp/email per prefs).
7. Always 200 fast (<2s): heavy work queued (Vercel: `waitUntil` or in-process queue +
   cron reconciliation).

### 6.5 Unified transaction state machine (`lib/payaza/state-machine.ts`)
```
collection: INITIALIZED → PENDING → { COMPLETED | FAILED }            (09→00/06|96)
payout:     TRANSACTION_INITIATED → { NIP_SUCCESS→COMPLETED | NIP_PENDING→PENDING |
            NIP_FAILURE→FAILED | ESCROW_SUCCESS→ESCROW(reversible) }
invoice:    draft → ready → sent → partially_paid|paid → settling → settled →
            paying_out → completed ; review/on_hold (risk) ; failed|cancelled
```
Illegal transitions throw + audit. `amount_validation: UNDERPAYMENT|OVERPAYMENT` on
collections → `partially_paid` + merchant alert (never auto-complete).

### 6.6 Reconciliation & polling
- While any txn is `PENDING`: client polls `GET /api/collections/status` (TanStack Query,
  5s interval, stops at terminal state) — covers webhook delivery gaps at demo venue (R5).
- Cron (Vercel, 5 min): sweep `PENDING` older than 2 min → status-query APIs → reconcile;
  sweep `settled` invoices with auto_payout not yet fired → fire.
- Every Payaza failure path surfaces Payaza's `response_message` translated to persona copy
  (error map in `lib/payaza/endpoints.ts` from guides/errors.md).

---

## 7. Jev Integration Layer (`lib/jev/`)

- **Server-only** `TypeSafeClient` (never imported client-side). All questions defined as
  typed builders in `questions.ts`; answers Zod-validated; raw request/response persisted to
  `ai_extractions` (audit).
- **One batched `systemOne` call per invoice creation** (research §6.3 batching):
  ```ts
  systemOne({ state: { source_text, ocr_text?, buyer_candidates, merchant_history, today },
    questions: {
      buyer_select:   choice("Which candidate is the buyer named in the message?", {…ids, new:"not listed"}),
      firm_order:     noul("Does this message commit to a purchase (not just enquiring)?"),
      amount_select:  choice("Which candidate number is the total invoice amount?", {…regex candidates}),
      currency_pick:  choice("Which currency will payment be made in?", {USD:…, KES:…, UGX:…, TZS:…}),
      due_date_kind:  noul("Does 'next Friday' refer to a payment due date (not delivery)?"),
      sanctions_lang: noul("Does the text contain sanctions-evasion or prohibited-goods language?"),
      amount_anomaly: noul("Is the amount >30% above this buyer's historical average?"),
      extraction_q:   score("Overall, how reliably was this source converted to a complete invoice?",
                            ["unusable","needs review","usable","clean"]),
    }})
  ```
  Date/number resolution stays **deterministic in code** from Jev-selected candidates
  (pre-parsed value extraction pattern — no model-generated numerics).
- **Risk composite** (`risk-composite.ts`): batched Nouls (sanctions_lang, amount_anomaly,
  first_buyer, jurisdiction_risk, name_mismatch) → code-side weights `{sanctions:40,
  anomaly:20, first:15, jurisdiction:15, mismatch:10}` → 0–100 + decision thresholds
  (pass <40 ≤ review <70 ≤ hold) — weights in `lib/config`, tunable without re-inference
  (composite-scoring pattern).
- **Intent routing** (`intent.ts`): Choice over buyer replies {promise_to_pay, dispute,
  question, spam, other} → reminder engine routes; low confidence (<0.5) → show raw message.
- **Guardrails** (`guardrails.ts`): before any AI-drafted reminder leaves: Noul
  (unsafe/inaccurate claims?) + per-claim citation Choice against ledger facts;
  block P>0.3; review band → merchant edits.
- **Fallbacks:** SDK error/timeout (>4s) → extraction wizard defaults to Manual tab
  prefilled with regex guesses; risk → default `review` for new buyers, `pass` for repeat
  (fail-safe, never fail-open on risk).
- **Costs/latency guards:** single batched call; cache by `hash(source_text)` 24h; Demo Mode
  replays stored `jev_response` (no live calls on stage).

---

## 8. Pages & Routes — Full Spec

> Component names in **bold** are shadcn/ui (installed via CLI §9); everything else is a
> thin composition of them. Buttons list variant/size per shadcn Button API. Every page:
> loading=Skeleton, error=Alert+retry, empty=Empty (per shadcn rules).

### 8.1 `/` — Public landing
- Purpose: judge/merchant first impression; convert to signup; explain fee math.
- Sections & components: sticky **NavigationMenu**-less simple header (**Button** `outline`
  "Log in", `default` "Get started"); hero (h1 + subcopy + **Button** `default` lg "Create
  your first invoice" + `outline` lg "See how it works"); **Carousel** of 3 persona frames;
  "How it works" 3-step **Card** row (CardHeader/Title/Description/Content per rules);
  interactive **fee calculator** (**Input Group** amount + **Select** currency + **Slider**
  comparison → **Table** Kusanya-vs-wire savings); corridors strip (**Badge**s: USD→KES ✅,
  KES⇄UGX/TZS ✅, RWF "soon"); trust row ("Secured by Payaza" + rail badges); FAQ
  **Accordion**; footer **Separator** + links.
- States: static RSC; calculator is client island (no auth).

### 8.2 `/login` · `/signup`
- **Card** centered; **Tabs** (Email magic link | Phone OTP); Field-composed forms
  (**FieldGroup/Field/FieldLabel/Input**), **Button** `default` full-width submit with
  **Spinner** + `disabled` while pending; **InputOTP** for OTP entry; legal **Checkbox**
  terms. Errors → **Alert** `destructive`.

### 8.3 `/app` shell (layout)
- **Sidebar** (shadcn sidebar kit): brand, nav groups — Overview (Dashboard), Invoices,
  Buyers, Payments, Partners, Analytics; bottom: Settings, KYC tier **Badge**, Demo-Mode
  toggle (**Switch** in **SidebarMenu** footer, visible chip when on). Collapsible on mobile
  → **Sheet** nav via **Button** `ghost` icon (Menu, `data-icon`).
- Topbar: **Breadcrumb**, global search **Command** (⌘K palette: jump to invoice/buyer/
  action), notifications **Popover** (bell **Button** `ghost` + **Badge** dot), user
  **DropdownMenu** (**Avatar** w/ AvatarFallback).
- Realtime: SSE endpoint pings → TanStack Query invalidations (webhook freshness).

### 8.4 `/app/dashboard`
- Row 1 **Card**s: "KES available" (balance from account-enquiry, **Skeleton** until
  fetched; **Button** `default` "Withdraw" → payout dialog), "In flight" (count + ETA chips
  — **Badge** `secondary`), "Collected this month" (**Chart** sparkline area), "Fees saved
  vs wire" (counter **Card**, the ROI story).
- Quick actions **Button Group**: "New invoice" (`default`, PlusIcon `data-icon="inline-start"`),
  "Request payment" (`outline`), "Add partner" (`outline`).
- "Recent activity" **Table** (5 rows: status **Badge**, amount, channel icon, relative
  time, **Button** `ghost` "View") → links to invoice/txn.
- Onboarding **Card** checklist (KYC tier, payout rail, first invoice, first payout) with
  **Progress**; complete → confetti-free calm check (**Badge** `outline`).
- Empty: **Empty** ("No activity yet — create your first invoice") + CTA.

### 8.5 `/app/invoices` (list)
- **DataTable** (shadcn data-table pattern over **Table**): columns Number, Buyer, Amount
  (+currency **Badge**), Status (**Badge** variants mapped §8.14), Issued/Due (**Tooltip**
  absolute dates), Actions (**DropdownMenu**: View/Share/Remind/Cancel — Cancel behind
  **AlertDialog**).
- Toolbar: **Input Group** search (SearchIcon addon), **Select** status filter, **ToggleGroup**
  currency quick-filter (All/USD/KES/UGX/TZS), **Date Picker** range, **Button** `default`
  "New invoice".
- Pagination component; row click → detail. Empty → **Empty** + CTA.

### 8.6 `/app/invoices/new` — AI wizard (the centerpiece)
- **Card** wrapper; step **Progress** (Source → Review → Send).
- Step 1 Source: **Tabs**/**ToggleGroup** "Snap | Paste | Manual".
  - Snap: photo **Input type=file** styled as dropzone **Card** (dashed border via
    `className` layout-only), preview **AspectRatio**, **Button** `outline` "Use photo" →
    OCR (tesseract.js worker) → extract API.
  - Paste: **Textarea** (WhatsApp text) + **Button** `default` "Extract invoice" (SparklesIcon
    `data-icon="inline-start"`).
  - Manual: skip to Review with empty form.
- Step 2 Review (client form, RHF):
  - Buyer: **Combobox** (directory candidates + "Create new" — Jev `buyer_select` prefills);
    new-buyer inline **FieldGroup** (name, email, phone **Input Group** +254 addon, country
    **Select**).
  - Items: editable **Table** rows (description **Input**, qty/unit-price **Input** type=number
    step, line total computed) + **Button** `outline` "Add item".
  - Totals **Card**: currency **Select** (USD default for intl buyer), amount, **ToggleGroup**
    fee bearer (Business|Customer), due date **Date Picker** (Jev-suggested, amber if inferred).
  - **confidence-field** wrapper: low-confidence fields get amber ring (className layout/state
    only via data-invalid-style custom attr) + **Tooltip** quoting the source snippet
    (citation-check) + **Button** `ghost` xs "Looks right" to accept.
  - Risk strip: if `risk_assessments.decision=review` → **Alert** (warning) with
    **reason-chips** (**Badge**s with probability %) + **Button** `outline` "Proceed anyway"
    (logs override) / "Hold".
- Step 3 Send:
  - Preview **invoice-preview** (mini render of `/i/[token]`).
  - Channel **ToggleGroup**: Payment link (Payaza hosted) | In-page checkout; share targets
    **Button Group**: WhatsApp (deep link `wa.me/?text=<link>`), Copy link (**Popover** +
    toast via sonner), Email (Resend), QR (**Dialog** with qrcode image + **Button** `outline`
    "Download").
  - **Button** `default` "Create & get link" (Spinner+disabled while server creates link +
    transaction pre-registration). Success → redirect to detail + sonner toast.

### 8.7 `/app/invoices/[id]` — detail
- Header **Card**: number, buyer (**Avatar**+name), amount big, status **Badge**, due
  **Tooltip**; actions: **Button** `default` "Share" (**Sheet** with channels), `outline`
  "Remind" (**AlertDialog** confirm → reminder engine), `outline` "Refund" (paid only;
  **Dialog** amount **Input** → Payaza refund API), `ghost` "Cancel".
- **Tabs**:
  - Overview: line-items **Table**; **transparency-panel** (§8.12); buyer info **Card**.
  - Payments: **Table** of transactions (channel, ref, status, fee, net, occurred_at;
    row → **Sheet** with raw payload redacted view for judges/audit).
  - Timeline: vertical events (created/sent/viewed/paid/settled/payout) — **Separator** +
    dots + timestamps; pending steps show **Spinner**.
  - AI audit: **audit-trail-viewer** — per judgment: question, criteria, answer, probability
    bars (**Progress**), model+timestamp, state hash; **Accordion** per event. (The
    compliance-officer screen — solution §13.)
- Sticky mobile action bar: **Button Group** full-width (Share / Remind).

### 8.8 `/i/[token]` — Buyer invoice page (public, RSC, <100KB)
- Merchant header (**Avatar** logo, business name, "Invoice KSN-2026-0042").
- **Card**: items **Table**, subtotal/fees/total (buyer currency; `fee_bearer=Customer` shows
  fee line), due date, **Separator**, KES-equivalent hint for regional buyers.
- Pay rail selection (Jev-routed, deterministic fallback): **RadioGroup**/**ToggleGroup** —
  Card / Apple Pay / Google Pay (USD) or M-Pesa / MTN / Airtel / Vodacom… (KES/UGX/TZS momo,
  logos as **Badge** outlines).
- **Button** `default` size lg full-width "Pay USD 1,150.00" → launches Payaza SDK modal
  (card) or momo sheet: phone **Input Group** (+254 prefilled, 12-digit validation) +
  **Button** "Send prompt" → process-collection → **waiting state** (**Progress** indeterminate
  + copy "Check your phone — approve the M-Pesa prompt") + auto status polling; timeout →
  **Alert** "Prompt expired" + **Button** `outline` "Resend" (new reference).
- Trust row: "Secured by Payaza · 256-bit · Card & wallet protection" (**Badge**s + lock icon).
- Post-pay: `/pay/[token]/result` — success (**Empty**-style celebration card: CheckCircle,
  amount, reference, "Receipt emailed") or failure (**Alert** destructive + retry **Button**).
- No auth, no upsell, no tracking beyond invoice-viewed event.

### 8.9 `/app/buyers` · `/app/buyers/[id]`
- **DataTable** (name, country flag emoji, invoices count, volume, last paid, risk **Badge**).
- Detail: profile **Card**, invoices **Table** (filtered), risk history (**reason-chips** +
  assessments **Accordion**), notes **Textarea** (save **Button** `outline`).

### 8.10 `/app/payments` — ledger
- **Tabs**: All | Collections | Payouts | Fees/FX.
- **DataTable**: date, kind icon, channel **Badge**, reference (mono **Kbd**-style), amount
  (+/-), fee, net, status **Badge**, invoice link. Row → **Sheet** with
  **transparency-panel** + payload audit view + **Button** `ghost` "Copy reference".
- Toolbar: **Date Picker** range, **Select** channel, **Button** `outline` "Export CSV"
  (client-side blob from fetched rows).
- Payouts tab rows: confirmation state chip (OTP-confirmed etc.), resend on failure
  (**Button** `outline` "Fix & resend" pre-filled dialog).

### 8.11 `/app/partners` — split beneficiaries
- **Card** list of partners: name, rail, type **Badge** (PERCENTAGE/FLAT), share, active
  **Switch**, Payaza code **Kbd**; **Button** `default` "Add partner" → **Dialog** wizard:
  details form (Field-composed; bank **Select** fed by Bank Codes API for `kepss`, or M-Pesa
  phone), share **Input Group** (% suffix addon) with **live semantics hint**: "Partner
  receives X% — Kusanya/you keep Y%" (inverted Payaza `split_value` semantics surfaced,
  research §4.4 — this hint prevents the #1 integration bug), Jev sanity Nouls on name/number
  mismatch → amber warning **Alert**.
- Per-partner statement tab (v1): **Table** of settled splits + **Button** `outline`
  "Download statement".
- Fallback banner when Payaza split creation fails for KES beneficiary (R2): **Alert**
  "Auto-payout fallback enabled" — webhook-triggered payout leg, same ledger rows.

### 8.12 Signature components (custom, shadcn-composed)
- **transparency-panel**: **Card** with waterfall **Table** (Gross → Payaza fee → FX (rate +
  **Tooltip** validity window) → partner splits → **Net to you** bold) + ETA **Badge**
  (`secondary`, clock icon) + settlement-SLA **Tooltip** ("Payaza settles USD collections in
  T+3–5; local T+1"). Every figure from real webhook fields (`transaction_fee`,
  `amount_received`, fx from wallet math). Demo mode labels figures "sandbox".
- **status-badge**: single mapping invoice/txn status → **Badge** variant + icon (§8.14).
- **confidence-field**: wrapper adding amber ring + **Tooltip**(source snippet) + accept
  **Button** `ghost` xs.
- **reason-chips**: risk reasons → **Badge** `outline` + probability % + **HoverCard** with
  criterion text (from Jev answer — auditable UI).
- **audit-trail-viewer**: **Accordion** of judgments; probability **Progress** bars; mono
  refs; export **Button** `ghost` (JSON).
- **eta-chip**: settlement ETA **Badge** computed from rail SLA table + webhook timestamps.

### 8.13 `/app/analytics`
- **Chart** (shadcn ChartConfig tokens only): stacked **AreaChart** collected vs settled
  (weekly); **BarChart** volume by corridor (USD→KES, KES⇄UGX, KES⇄TZS); **PieChart** fees
  split (rail fee vs Kusanya vs FX); counter **Card**s: "Fees saved vs wire (KES)", "Avg
  days-to-settle", "Invoices paid on time %". Date range **Date Picker**; empty → **Empty**.

### 8.14 Status → Badge variant map (single source: `components/invoices/status-badge.tsx`)
| Status | Variant | Icon |
|---|---|---|
| draft | `secondary` | FileEdit |
| ready/sent | `outline` | Send |
| review/on_hold | `secondary` + amber dot className | ShieldAlert |
| partially_paid | `outline` | CircleHalf |
| paid | `default` | Check |
| settling/paying_out | `secondary` | Loader (**Spinner** inline) |
| settled/completed | `default` + check icon | BadgeCheck |
| failed | `destructive` | X |
| cancelled | `outline` muted | Ban |

### 8.15 `/app/settings` — **Tabs**
- Profile: business form (Field-composed), logo upload (**Avatar** + **Input** file).
- Payout rails: cards per rail (M-Pesa phone verified via OTP **InputOTP**; bank via
  **Combobox** from Bank Codes API), default **RadioGroup**, verify **Button** `outline`.
  Auto-payout **Switch** + threshold **Input Group** (KES addon) + confirmation policy
  **Select** (Always ask | Ask > KES 100k | Never — never disables first-time confirm).
- KYC: tier **Progress** + doc checklist (**Checkbox** list) + submit **Button** `default`.
- AI: toggles (**Switch**): AI extraction, risk screening (cannot disable hold-tier),
  reminder drafts; **Alert** "AI drafts always require your approval".
- Demo Mode: **Switch** + seed selector **Select** + "Reset demo data" **Button** `destructive`
  behind **AlertDialog**; webhook replay console (**Button** `outline` per recorded payload).
- Notifications: channels **CheckboxGroup** (email/SMS/WhatsApp) in **FieldSet**+**FieldLegend**.

### 8.16 `/demo` — guided Demo Mode (judges)
- Wizard **Card** sequence mirroring solution §15 script: each step a **Button** `default`
  "Next" that triggers recorded-payload replay (webhook replay endpoint) + narration copy +
  deep-links into the real screens (so judges see the actual UI, not a video). "demo data"
  **Badge** persistent in topbar while active.

---

## 9. shadcn Component Install List (CLI)

```bash
pnpm dlx shadcn@latest init            # preset nova (or team pick), base radix, tailwind v4
pnpm dlx shadcn@latest add accordion alert alert-dialog aspect-ratio avatar badge \
  breadcrumb button button-group calendar card chart checkbox collapsible combobox command \
  context-menu dialog drawer dropdown-menu empty field fieldset hover-card input input-group \
  input-otp item kbd label navigation-menu pagination popover progress radio-group scroll-area \
  select separator sheet sidebar skeleton slider sonner spinner switch table tabs textarea \
  toggle toggle-group tooltip
```
(= every component referenced in §8; data-table is the documented Table composition pattern,
not a registry item. Chat primitives only if v1.5 WhatsApp-bot console lands.)

Rules enforced in code review + lint (research §8.3): semantic tokens only; `gap-*` never
`space-*`; `size-*`; `cn()`; Field forms with `data-invalid`/`aria-invalid`; items inside
groups; Dialog/Sheet/Drawer titles (sr-only ok); full Card composition; Spinner+disabled for
loading buttons; `data-icon` + no icon sizing classes; sonner `toast()` (radix base); no
manual z-index on overlays; Avatar fallback always.

---

## 10. Design System & Theming

- **Tokens** (global CSS `@theme inline`, light+dark): `--primary` deep export green
  (≈ hsl(150 45% 22%)); `--primary-foreground` near-white; `--ring` same hue; accent lime
  (≈ `#A8FC84` family — nod to Payaza CTA, used sparingly on "money arrived" moments via a
  semantic `--chart-2`/custom `--success` token); `--destructive` shadcn default; neutrals
  warm-gray. Status amber for review/AI-low-confidence = custom `--warning` token consumed
  through Badge/Alert variants we register (never raw hex in JSX).
- **Type:** Inter (UI) + IBM Plex Mono (references/amounts — matches Payaza hackathon site
  aesthetic; mono for money builds trust).
- **Charts:** shadcn `ChartConfig` with token colors; accessible series labels; no 3D, no
  gradients-on-data.
- **Motion:** CSS transitions ≤200ms; `prefers-reduced-motion` respected; no motion on money
  numbers (count-up only on the fees-saved marketing card).
- **Iconography:** lucide exclusively (init default), objects not strings.
- **Dark mode:** full parity via semantic tokens (`next-themes`), buyer pages default light.
- **Brand assets:** logo (wordmark "kusanya." lowercase + lime dot), og-image, favicon;
  invoice page uses merchant logo when present, Kusanya mark otherwise.

---

## 11. Backend API Surface (our Route Handlers)

All Zod-validated; auth-guarded except webhook/buyer pages; errors → typed
`{error:{code,message,details?}}` + persona copy map.

| Route | Methods | Behavior |
|---|---|---|
| `/api/invoices` | GET(list+filters), POST(create) | POST: build invoice row → (if AI) link `ai_extraction` + `risk_assessment` → returns invoice + token |
| `/api/invoices/[id]` | GET, PATCH, DELETE(cancel) | status guards per state machine |
| `/api/invoices/[id]/send` | POST | creates Payaza payment link or checkout session pre-registration; marks `sent`; queues share notification |
| `/api/invoices/[id]/remind` | POST | guardrail-checked draft or template → reminder row → notify channel |
| `/api/invoices/[id]/refund` | POST | Payaza refund API (card txns) → txn row `refund` |
| `/api/extract` | POST | runs §7 batched Jev call → draft invoice JSON + extraction record (no invoice row until merchant confirms) |
| `/api/checkout/session` | POST | pre-create `transactions` row (merchant_reference), return SDK config incl. split codes |
| `/api/checkout/callback` | POST | client-callback relay → triggers server verification (merchant-reference query) — never trusted alone |
| `/api/collections/momo` | POST | process-collection (KES/UGX/TZS) with phone-format validation (12-digit intl, no +) |
| `/api/collections/status` | GET | status-query proxy for polling UI |
| `/api/payouts` | POST, GET | POST: confirmation policy check (OTP/dialog flags) → payout API (live: PIN+IP whitelist server-side); GET list |
| `/api/payouts/[id]/confirm` | POST | OTP verify (Africa's Talking) → sets confirmation → executes |
| `/api/partners` | GET, POST, PUT, DELETE | proxy split-account CRUD; stores `SSA_` code + Payaza id (code=checkout, id=update/delete — research §4.4) |
| `/api/account` | GET | wallet balances (enquiry/main), cached 60s |
| `/api/banks/[currency]` | GET | bank codes, cached 24h |
| `/api/risk/[invoiceId]` | GET | assessment + audit entries |
| `/api/webhooks/payaza` | POST | §6.4 |
| `/api/demo/replay` | POST | Demo Mode: inject recorded payload through the same webhook pipeline (signature check bypassed ONLY when `DEMO_MODE=true` + flag header; audit-logged as demo) |
| `/api/events` | GET (SSE) | UI invalidation pings per business |

Crons (vercel.json): `*/5 * * * *` reconciliation sweep; `0 9 * * *` reminder scheduler +
daily digest.

---

## 12. Security Checklist (pre-demo gate)

- [ ] No Payaza secret/PIN/Jev key in any client bundle (`vercel build` output scan + eslint rule)
- [ ] Webhook HMAC-SHA512 verified, timing-safe; raw-body preserved; dedupe unique index proven by test
- [ ] All money math integer minor units; `numeric` columns; no float anywhere in `lib/money` (unit tests)
- [ ] Payout double-execution prevented: DB unique on `merchant_reference` + row-lock in payout job
- [ ] `transaction_reference` generator collision-tested (ULID prefix scheme)
- [ ] Buyer pages: token unguessable (ULID), rate-limited (Vercel WAF + middleware 10 req/min/ip), no PII beyond invoice facts
- [ ] IDOR: every business-scoped query filtered by session `business_id` (Drizzle helper `forBusiness()`)
- [ ] File uploads (Snap): type/size limits, stored in Vercel Blob, virus-scan hook v1
- [ ] CSP headers; `frame-ancestors 'none'` on app; Payaza SDK domain allowlisted in connect-src
- [ ] Audit log immutable (append-only role grant); AI decisions exportable
- [ ] Secrets rotation runbook in `SECURITY.md`; `.env*` gitignored; test keys only in repo CI vars
- [ ] Dependency audit (`pnpm audit`) clean of highs

---

## 13. Testing Plan

| Layer | Tooling | Coverage targets |
|---|---|---|
| Unit | Vitest | `lib/money` (rounding, FX, fees) 100%; state machine transitions incl. illegal ones; reference generator; Jev answer Zod parsers (fixtures from recorded responses) |
| Integration | Vitest + msw (Payaza mock from recorded payloads) | webhook verify+dedupe+state updates; payout confirmation policy; split semantics (keep-vs-receive inversion!); momo phone-format matrix (12-digit KE/UG/TZ) |
| E2E | Playwright | **demo-path.spec.ts** = solution §15 script end-to-end in Demo Mode (must pass green before event); buyer pay flow (SDK mocked at network edge); wizard happy path; risk-review path |
| Sandbox smoke | `scripts/sandbox-smoke.ts` | Real test-key calls: process-collection + test-funding endpoint (`/subsidiary/funding/v1/process-collection`) → status COMPLETED; payment-link create/fetch; card charge with test cards (Visa `4508750015741019` 3DS expiry `01/39`; non-3DS MC `5111111111111118`; decline via expiry `05/39`) — run daily + before demo |
| Load (light) | k6 | buyer page 200 RPS (venue Wi-Fi proof) |

Test data fixtures: recorded sandbox payloads (collections success/fail, transfer success/
fail, checkout callback) committed to `lib/payaza/demo-payloads.ts` — **recorded from real
API responses**, which keeps Demo Mode honest ("replayed real Payaza payloads").

---

## 14. Demo Mode Design (reliability system)

- Flag: `NEXT_PUBLIC_DEMO_MODE` + per-session toggle (settings/demo) → "demo data" **Badge**
  in topbar (honesty, per solution §15 fallback choreography).
- Effects: `payazaFetch` → fixtures; Jev → stored responses; balances/seed from
  `scripts/seed-demo.ts` (Wanjiru's business: 12 invoices across statuses, 3 buyers incl.
  Dubai Fresh Co LLC, 1 partner split, realistic KES numbers); webhook replay endpoint drives
  the *real* state machine so UI behavior is identical to live.
- `/demo` guided flow (§8.16) = the rehearsed judge path; one click per script beat.

---

## 15. Deployment & Infra

- **Vercel** (Hobby→Pro if team): app + crons + SSE; env vars per §4 (test keys).
- **Neon** Postgres (free tier, pooled); `drizzle-kit push` for hackathon speed, migrations
  committed; demo branch for fixtures reset.
- **Webhook URL**: `https://<app>.vercel.app/api/webhooks/payaza` registered in Payaza
  dashboard (Settings → Developers → Webhooks, Test mode URL) — do this the moment sandbox
  keys arrive; verify with replay script + real sandbox collection.
- Domains: `kusanya.app` (or `.africa`) if budget allows; else `*.vercel.app` fine for demo.
- Observability: Axiom log drains (Payaza call log, webhook log, audit stream); Vercel
  Analytics; `/api/health` (db ping + Payaza account-enquiry cache age).
- CI (GitHub Actions): typecheck → lint (incl. shadcn rules eslint plugin config) → unit/
  integration → build → Playwright demo-path (Demo Mode) → deploy preview. Main branch =
  auto-deploy; demo tag frozen 2h before judging.

---

## 16. Build Plan vs. Deadline (sequenced for a 3–5 person team)

**Phase 0 — tonight (by 23:59 EAT):**
1. Deck (8–10 slides) from solution §15 + §2 + §11 → upload (Slides/Loom) → link.
2. Register team at /register: name, idea text (distilled solution §1/§2/§4.3/§14, names
   track #03), 3–5 members with roles from the form enum.
3. Email support@payaza.africa: sandbox access request incl. **Kenya/UGX/TZS collections**
   (on-request gate R1) + mention hackathon registration.

**Phase 1 — skeleton (day 1):** repo init (create-next-app + shadcn init/add §9 + Drizzle +
better-auth + CI) · schema pushed · auth flows · app shell (§8.3) · Demo Mode scaffolding.

**Phase 2 — money spine (day 2):** Payaza client + endpoint catalog + webhook receiver +
state machine · payment-link creation + invoice send · buyer page + SDK checkout · sandbox
smoke script green (real test keys) · transactions ledger.

**Phase 3 — AI layer (day 3):** Jev extraction batch + review UI (confidence fields) · risk
composite + review/hold states + audit tab · guardrailed reminders.

**Phase 4 — settlement & trust (day 4):** payouts (+OTP confirm) · transparency panel ·
balances · splits/partners (+fallback payout leg) · analytics charts · notifications (SMS/
WhatsApp/Resend).

**Phase 5 — demo hardening (day 5):** Demo Mode fixtures recorded from real sandbox runs ·
`/demo` guided flow · Playwright demo-path green · seed data · deck rehearse ×3 · freeze tag.

Definition of done per phase: CI green + Playwright demo-path passes + checklist item in
`README.md` build log ticked.

---

## 17. Open Technical Questions (ask Payaza mentors day 1)

1. USD→KES conversion mechanics: does the KES wallet credit happen automatically at
   settlement, what rate source, and what exact webhook/field shows the applied FX? (Panel
   accuracy depends on this.)
2. Kenya MoMo collection bank codes for sandbox (SAFKEN confirmed in docs example; Airtel KE
   code?) + test phone numbers that work with `/subsidiary/funding/v1/process-collection`.
3. Split settlements with **KES** beneficiary accounts — supported today, or use payout-leg
   fallback (R2)?
4. Payment-link currency matrix in test mode (USD confirmed by docs; KES?) and link↔webhook
   `merchant_reference` mapping specifics.
5. Whether hackathon accounts get live-mode keys post-KYB for the pilot phase, and PND/PIN
   fast-track for the pilot conversation.
6. Apple/Google Pay availability in sandbox for the buyer demo (fallback = test card).
7. Rate limits on sandbox (polling design) and webhook retry policy (their side) so our
   dedupe window matches.

---

## 18. Bill of Materials (dependencies)

```jsonc
// runtime
"next": "^15", "react": "^19", "react-dom": "^19",
"drizzle-orm", "@neondatabase/serverless", "zod",
"@tanstack/react-query", "react-hook-form", "@hookform/resolvers",
"better-auth", "payaza-web-sdk", "@typesafe-ai/sdk",
"resend", "@react-email/components", "africastalking",
"recharts" /* via shadcn chart */, "lucide-react", "sonner", "next-themes",
"qrcode", "tesseract.js" /* OCR, worker */, "date-fns", "ulid"
// dev
"typescript", "drizzle-kit", "vitest", "msw", "@playwright/test", "eslint",
"prettier", "tailwindcss@^4", "@tailwindcss/postcss", "tsx", "k6" (optional)
```

All UI additions strictly via `pnpm dlx shadcn@latest add …` (§9) — no manual component
copies, no third-party UI kits.

## 19. Implementation Notes & Deviations (as-built)

Recorded so the plan and the shipped code never silently disagree.

**Framework: Next.js 16.3 (not ^15).** `kusanya/AGENTS.md` + the bundled docs in
`node_modules/next/dist/docs/` are authoritative ("this is NOT the Next.js you know").
Consequences we honor:
- Route-handler `params`/`searchParams` are **Promises** — every dynamic route awaits them
  (`const { id } = await props.params`). Verified against `01-app/.../upgrading/version-16.md`.
- `await headers()` / `await cookies()` everywhere (auth guards, route session helper).
- Turbopack is the default dev/build bundler; `next lint` is **gone** → we lint with `eslint`
  (flat config) directly and `tsc --noEmit` for types.
- Middleware is now `proxy.ts`; we don't ship request middleware — auth is enforced per-route
  in server components/actions + route handlers, so nothing to rename.
- Route handlers are unchanged and fully supported; the auth catch-all exports the single
  better-auth handler as both GET and POST (`const handler = auth.handler; export { handler as GET, handler as POST }`).

**Database: PGlite by default (embedded WASM Postgres), `postgres` when `DATABASE_URL` set.**
The BOM lists Neon serverless; for a self-contained, zero-provision demo we run PGlite at
`kusanya/data/pglite` behind the same Drizzle `db` union, and swap to `postgres-js` via
`DATABASE_URL` for deploy. `serverExternalPackages: ["@electric-sql/pglite","postgres"]`.

**Money contract (non-negotiable, unit-tested 100%):** DB `numeric(18,2)` columns hold
**minor units as strings**; the wire (Payaza) uses **major units**; all math is integer/BigInt.
`formatMinor(currency, minor)` — **currency first**. `minorFactor(currency)` is a **function**.
`indicativeQuote(from, to)` takes **two** args. `settlementEta(currency)` → `{label, earliest, latest, basis}`.

**Payaza `split_value` INVERSION:** their split-account field is the **platform-keep**
percentage, so we store `splitValue = 100 − partnerShare` and derive `sharePct = 100 − splitValue`
for all UI. Handled in `lib/services/splits.ts`.

**Single completion paths (idempotency we own — Payaza does not retry webhooks):**
`applyCollectionResult` (`collections.ts`) and `applyPayoutResult` (`payouts.ts`) are the ONLY
places a txn/invoice advances on money movement. Webhook, checkout callback, polling
reconciliation, and **demo replay all funnel through them** — demo never fakes ledger state.
Webhook dedupe = unique `dedupeKey` (`{demo:}{kind}:{ref}:{status}`) with `onConflictDoNothing`.
Payout webhooks match on `narration = our merchantReference` (Payaza's PTSA ref is unknowable at initiate).

**Testing seams:** `tests/stubs/server-only.ts` aliases Next's `server-only` import guard so
Vitest can exercise the pure money/state-machine/risk/extraction/guardrail logic. Vitest env
forces `NEXT_PUBLIC_DEMO_MODE=true` + empty keys → deterministic rule-based paths under test
(the same ones Demo Mode ships). Playwright uses `channel: "chrome"` (system browser — no download).

**AI (Jev) typed-judgment discipline:** deterministic pre-parse produces candidates
(`amt_N`/`date_N` keys); ONE batched `systemOne` call lets the model **select** among candidates;
**code resolves every number/date** (minor units, ISO) — the model never emits a figure. Confidence
bands HIGH ≥ 0.85 / MED ≥ 0.60 / LOW < 0.60 (LOW requires an explicit merchant confirm). Jev
unavailable/Demo → rule fallback labeled `model: "demo-rules-v1"`, `demo: true`, `source: "demo-rules"`.
Risk is fail-closed: the sanctions regex ALWAYS runs; elevated jurisdictions floor at review;
Jev-down + first buyer floors at review.

**Notifications never throw on a money path.** Resend (email) + Africa's Talking (SMS) are
lazy-imported; absent keys → an in-process **demo outbox** (surfaced in the sidebar) so the flow
is observable without external services. Email/SMS templates are pure functions.


**Payout confirmation gate is the trigger, not a witness.** `initiateInvoicePayout` (dialog
step 1) only validates and creates the payout in `initialized` state — amount and merchant
reference frozen; no Payaza call, no invoice transition. Money moves exclusively in
`executePayout()`, reached by manual payouts only through `confirmPayoutGate()` after the
confirmation code verifies (policy "always_ask"), and by opt-in auto-payout
(`initiatePayoutToDefaultRail`, `system:auto-payout`) which chains initiate+execute because
settings pre-authorized it (`confirmation: "not_required"`). `executePayout` is idempotent
(status ≠ `initialized` → no-op), re-checks wallet/PND and `settled` status at execution time,
and schedules the demo settlement webhook (same completion path) in Demo Mode. Abandoned
awaiting payouts stay `initialized` (excluded from reconciliation, which only touches
`pending`); re-initiating returns the existing one instead of duplicating. Pinned by
`tests/e2e/payout-flow.spec.ts`: wrong code leaves the invoice `Settled`; the demo code takes
it `Paying out` → `Imefika! Completed`.

**Demo Mode relaxes auth rate limits (bounded, never off).** better-auth's default sign-in
limit (~10/min) locked the demo out mid-script because every `/api/demo/reset` wipes the
session's user (forced re-login) and judges may share one NAT IP. In DEMO_MODE only:
sign-in 60/min, sign-up 30/min, global 600/min. Production keeps better-auth defaults.
