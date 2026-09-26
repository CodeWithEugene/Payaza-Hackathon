# Kusanya UI Build Contract (internal — for parallel build agents)

Everything a UI page/component needs. **Do not invent endpoints, columns, or
props not listed here.** If something is missing, query the DB directly in a
Server Component using the schema below (drizzle `db` from `@/lib/db/client`,
tables from `@/lib/db/schema`).

## Hard rules (violating these = rejected work)

1. **Strictly shadcn/ui (nova preset, radix base).** Only import from
   `@/components/ui/*` (installed list below). NEVER raw palette colors
   (`bg-blue-500`, `text-amber-700`…) — semantic tokens only (`bg-primary`,
   `text-muted-foreground`, `bg-destructive/10`, `border-border`). No manual
   `dark:` overrides. No `space-x/y-*` (use `flex … gap-*`). `size-*` for
   square dims. `truncate` shorthand. `cn()` for conditionals.
2. Forms: `FieldGroup`/`Field`/`FieldLabel`/`FieldDescription` (+ `data-invalid`
   on Field, `aria-invalid` on control). 2–7 option sets → `ToggleGroup`.
   Icons inside `Button` → `data-icon="inline-start"` (no size classes).
   `SelectItem` inside `SelectGroup`. `Dialog` always has `DialogTitle`.
   Empty states → `Empty` component. Loading → `Skeleton`/`Spinner`.
   Alerts/callouts → `Alert`. Status → `Badge` (or our `StatusBadge`).
   Card = full composition (`CardHeader/CardTitle/CardDescription/CardContent/CardFooter`).
3. **Next.js 16**: `params` and `searchParams` are PROMISES — `const { id } = await props.params`.
   Route handlers: `{ params }: { params: Promise<{ id: string }> }`.
   `await headers()` / `await cookies()`. `revalidatePath` OK. Turbopack default.
4. Server Components by default; `"use client"` only for hooks/handlers/browser APIs.
5. **Money**: DB numeric columns are STRINGS in MINOR units. Display via
   `<Amount minor={Number(x)} currency="USD" />` from `@/components/money/amount`
   (or `formatAmountMinor(minor, currency)` — same module). Never float math.
   Wire amounts to APIs are MAJOR units only where the API says so.
6. Status pills: `<StatusBadge status={inv.status} />` from `@/components/invoices/status-badge`.
7. No new npm dependencies. No running `tsc`/`eslint`/`next build`/`next dev`
   (the orchestrator integrates). Do not edit files outside your assignment.
8. Icons: `lucide-react`. Toasts: `sonner` (`toast.success(...)`, `toast.error(msg)`).
9. Auth in app pages: `const { user, business } = await requireBusiness()` from
   `@/lib/auth/guards` (throws redirect to /login when absent).
10. Voice: warm, professional, plain English for Kenyan SME exporters. Honest
    states: estimates are labeled "estimated until Payaza confirms". The only
    Swahili moment is `Imefika!` on completed payout (already inside StatusBadge).
    Errors surface the server's persona copy verbatim (`ActionResult.error`).
11. Every interactive mutation: call server action or fetch API → on
    `{ok:false,error}` show `toast.error(error)`; on success `toast.success` +
    `router.refresh()` (or TanStack Query invalidation for polling views).

## Installed ui components (import `@/components/ui/<name>`)

accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb,
button-group, button, calendar, card, chart, checkbox, collapsible, combobox,
command, context-menu, dialog, drawer, dropdown-menu, empty, field, hover-card,
input-group, input-otp, input, item, kbd, label, navigation-menu, pagination,
popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar,
skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle-group,
toggle, tooltip

`chart.tsx` = shadcn ChartContainer/ChartTooltip (wraps recharts — recharts IS
installed). Use `ChartContainer` + `ChartTooltip` + recharts primitives, and
`ChartLegend` where useful. Chart colors: `var(--chart-1..5)` via the
`chartConfig` pattern.

## Shared components that already exist

- `@/components/money/amount` → `Amount({minor, currency, className?, signed?})`,
  `formatAmountMinor(minor, currency)`.
- `@/components/invoices/status-badge` → `StatusBadge({status})`, `statusLabel(status)`.
- `@/components/layout/*` (sidebar/topbar/user-menu/demo-outbox/live-updates) — owned by orchestrator, do not edit.
- `@/components/providers` — QueryClientProvider — already mounted in root layout.
- `@/components/theme-provider` — already mounted.

## Server actions (call directly from forms/client components)

```ts
// "@/lib/actions/auth"
signUpWithBusiness({ name, email, password, businessName, country?, phone?, mpesaNumber? })
  → ActionResult<{userId, businessId}>   // signs the user in (session cookie)
interface ActionResult<T=undefined> { ok: boolean; error?: string; data?: T }

// "@/lib/actions/invoices"
createInvoiceAction(input: CreateInvoiceInput)
  → ActionResult<{invoiceId, status, riskDecision: "pass"|"review"|"hold", riskScore}>
// CreateInvoiceInput = {
//   buyer: { existingId: string } | { name, kind: "person"|"company", country (2-letter), email?, phone? },
//   items: { description, qty: number>0, unitPriceMinor: number|null }[],
//   totalMinor: number(int), currency: "USD"|"KES"|"UGX"|"TZS",
//   dueAt: string|null (ISO datetime), notes?: string|null,
//   feeBearer: "business"|"customer", extractionId?: string|null, sendNow: boolean }
sendInvoiceAction(invoiceId) → ActionResult
cancelInvoiceAction(invoiceId, reason) → ActionResult
resendInvoiceAction(invoiceId) → ActionResult
simulateSettlementAction(invoiceId) → ActionResult   // DEMO: paid→settled

// "@/lib/actions/rails-partners"
initiatePayoutAction(invoiceId, railId) → ActionResult<{payoutId, amountDisplay}>
saveRailAction({ railId?, rail: "mpesa"|"kepss_bank", phone?, accountNumber?, accountName, bankCode?, isDefault }) → ActionResult<{railId}>
createPartnerAction({ name, email, accountNo, accountName, bankCode, sharePct }) → ActionResult<{partnerId}>
deactivatePartnerAction(partnerId) → ActionResult
attachSplitsAction(invoiceId, [{partnerId, sharePct}]) → ActionResult
updateSettingsAction(settingsObject) → ActionResult   // merges into businesses.settings
```

## HTTP APIs (client-side fetch)

```
POST /api/invoices/extract        {text, ocrText?, sourceType:"paste"|"snap"|"manual", photoUrl?}
  → { extractionId, result: InvoiceExtractionResult, }   (see below)
GET  /api/invoices/[id]/status    → { invoice:{id,number,status,currency,amountMinor,dueAt},
                                      transactions:[...], reminders:[...], waterfall: InvoiceWaterfall }
POST /api/invoices/[id]/risk/override  {to:"ready"|"review"|"cancelled", note}
POST /api/invoices/[id]/reminders/[rid]/draft    {body?} → {guardrail}
POST /api/invoices/[id]/reminders/[rid]/approve  → sends it
POST /api/payouts/[id]/confirm    {code}          // confirmation gate
GET  /api/wallets[?refresh=1]     → {wallets:[{currency,balance,status,reference,productCode,postNoDebit}]}
GET  /api/bank-codes?currency=KES → {currency,data:[{name?,code,...}],cached}
GET  /api/events                  → SSE (already consumed by LiveUpdates; don't re-consume)
POST /api/demo/replay             {event, reference}   // DEMO_MODE only; events:
   collection.success|collection.underpay|collection.overpay|collection.failed (reference = txn merchantReference "KSN-…"),
   momo.success (reference = txn ref), payout.success|payout.failed (reference = payout txn ref),
   settlement.complete (reference = INVOICE id)
POST /api/demo/reset              → wipes+reseeds demo story; returns {login:{email,password}, businessId, invoiceIds}
GET  /api/demo/outbox             → [{to,subject,tag,at}] (polled by demo-outbox button)
POST /api/buyer/momo    {token, phone, network?}   → {txnId, merchantReference, status, message}   (Agent E creates this route)
POST /api/buyer/checkout {token}                    → {sdkConfig, merchantReference}             (Agent E creates this route)
```

## Key types

```ts
// InvoiceExtractionResult ("@/lib/jev/types" is server-safe to import types from;
// for client components, re-declare the shape or fetch JSON):
{
  buyer: ExtractedField<string>,           // {value, confidence 0..1, snippet: string|null, deterministic: bool, demo?: bool}
  buyerCandidateId: string|null,           // matched directory buyer
  items: {description, qty:number, unitPriceMinor:number|null, currency:string|null, confidence:number}[],
  total: ExtractedField<number>,           // MINOR units
  currency: ExtractedField<string>,        // USD|KES|UGX|TZS
  dueDate: ExtractedField<string>,         // ISO date "2026-10-01"
  firmOrder: ExtractedField<boolean>,
  quality: number, model: string, durationMs: number
}
// extract API ALSO returns result.buyerCandidates: {id,name,country,email,phone}[]

// Confidence bands (hard-coded in UI): HIGH ≥0.85 (normal), MED ≥0.60 (subtle
// outline + tooltip snippet), LOW <0.60 (secondary bg + snippet shown + user
// must tap "Confirm" on that field before submit). `deterministic:true` →
// show a small Badge "code-verified" (numbers/dates resolved in code).
// `demo:true` or model "demo-rules-v1" → Badge "Demo rules" on the result header.

// InvoiceWaterfall (from GET status or server-side invoiceWaterfall(invoice)):
{
  lines: { label, minor: number /*signed*/, currency, kind: "gross"|"fee"|"fx"|"split"|"net", note? }[],
  estimated: boolean, netMinor, netCurrency, fxRate: string|null,
  grossMinor, railFeeMinor, payoutFeeMinor, settleEtaDays: string
}
// Render lines in order; kind=fee/split lines have NEGATIVE minor; kind=fx line
// shows conversion; kind=net is the bold total. When estimated → show
// "Estimated until Payaza confirms" note (Alert or muted text).
```

## DB schema quick-ref (string minor units, exact column names)

- businesses: id, userId, name, slug, country, kycTier, invoiceSeq, settings(jsonb), logoUrl, createdAt
- payoutRails: id, businessId, rail("mpesa"|"kepss_bank"), phone, bankCode, accountNumber, accountName, verified, isDefault, createdAt
- buyers: id, businessId, kind, name, email, phone, country, riskFlags, createdAt
- invoices: id, businessId, buyerId, number, token, status, currency, amountMinor, fxRate, fxQuoteExpiresAt, dueAt, notes, feeBearer, issuedAt, payazaLinkId, payazaLinkUrl, checkoutSessionRef, aiMeta, createdAt, updatedAt
  statuses: draft|ready|sent|partially_paid|paid|settling|settled|paying_out|completed|failed|cancelled|review|on_hold
- invoiceItems: id, invoiceId, currency, description, qty(string), unitPriceMinor(string), position
- transactions: id, businessId, invoiceId, merchantReference, payazaReference, kind("collection"|"payout"), direction("in"|"out"), channel("card"|"momo_ke"|"momo_ug"|"momo_tz"|"mpesa_payout"|"kepss_payout"|"payment_link"), currency, amountMinor, feeMinor, netMinor, status("initialized"|"pending"|"completed"|"failed"|"reversed"|"escrow"), payazaStatusRaw, payload, occurredAt, createdAt
- payouts: id, transactionId, railId, beneficiaryName, beneficiaryAccount, amountMinorKes, confirmation, pinUsed, batchReference, status, createdAt
- splitBeneficiaries: id, businessId, name, email, accountNo, bankCode, rail, splitType, splitValue (INVERTED: platform-keep = 100−partnerShare), payazaSplitCode, payazaSplitId, fallbackPayoutRailId, active, createdAt, updatedAt
- invoiceSplits: id, invoiceId, beneficiaryId, sharePct(string), expectedAmountMinor, settledAmountMinor
- reminders: id, invoiceId, channel("email"|"sms"|"whatsapp"), body, scheduledAt, sentAt, draftedBy("template"|"jev"|"merchant"), guardrail(jsonb|null), status("scheduled"|"draft"|"blocked"|"sent"|"cancelled"), createdAt
- riskAssessments: id, invoiceId, compositeScore(int), decision("pass"|"review"|"hold"), reasons([{key,label,probability,weight,criterion}]), fallback(bool), createdAt
- webhookEvents: id, eventKind, transactionReference, signatureValid, dedupeKey, payload, processed, error, receivedAt
- auditLog: id, actor, action, entityType, entityId, before, after, aiRef, createdAt

## Services usable in Server Components (import from "@/lib/services/…")

- invoices: `listInvoices(businessId, {status?, q?, page?, pageSize?}) → {rows:[{invoice, buyerName, buyerCountry, paidMinor}], total, page, pageSize}`;
  `getInvoiceDetail(businessId, invoiceId) → {invoice, buyer, items, transactions, payouts, risk, splits:[{split, partnerName, partnerShare}], reminders}`;
  `getBuyerInvoice(token) → {invoice:{id,businessId,number,token,status,currency,amountMinor,dueAt,notes,createdAt,payazaLinkUrl,feeBearer,buyerId}, business:{name,country}|null, buyer:{name,kind,country}|null, items:[{description,qty,unitPriceMinor}], transactions:[{id,kind,channel,status,currency,amountMinor,occurredAt,reference}]} | null`
- waterfall: `invoiceWaterfall(invoiceRow) → InvoiceWaterfall`
- payouts: `getWallets(businessId, force?) → {data:[{currency, accountBalance, status, payazaAccountReference, productCode, postNoDebit?}]}`, `DEMO_PAYOUT_CODE = "123456"`
- splits: `listPartners(businessId) → PartnerView[] (SplitBeneficiary & {sharePct})`, `partnerStatement(businessId, partnerId, from, to) → {partner, rows:[{invoiceNumber, invoiceStatus, sharePct, expectedDisplay, settledDisplay, updatedAt}], settledTotalDisplay, expectedTotalDisplay}`
- reminders: `listReminders(invoiceId) → reminders[]`
- extraction: `loadBuyerCandidates(businessId)`

## Auth client (for login page, client component)

```ts
import { authClient } from "@/lib/auth/api-client";
const { error } = await authClient.signIn.email({ email, password });
// then router.push("/app"); router.refresh();
```

## Money/FX helpers (server or client-safe)

- `@/lib/money/format`: `formatMinor(currency, minor)` — CURRENCY FIRST. Server-side display OK.
- `@/lib/money/fx`: `settlementEta(currency) → {label, earliest, latest, basis}` — "T+3–5 business days" USD, "T+1" local.

## Demo facts (show where relevant, e.g. settings/demo page)

- Demo login: `wanjiru@kusanya.demo` / `kusanya-demo-2026`
- Demo payout confirmation code: `123456` (`DEMO_PAYOUT_CODE`)
- Payaza test cards: Visa `4508750015741019`, expiry `01/39` = approved, `05/39` = declined, any CVC/future date.
- Demo Mode banner is already in the topbar; don't duplicate it.
