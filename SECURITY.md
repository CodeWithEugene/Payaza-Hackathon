# Security Policy

Kusanya moves money (on Payaza's licensed rails) and processes AI judgments about trade
documents. Security is a product feature here, not a checklist. This policy covers secrets,
payment-flow security, data protection, and vulnerability reporting.

## Supported versions

During the hackathon, only `main` (and the `demo-freeze` tag during judging) is supported.
Security fixes land on `main` immediately and take precedence over all feature work.

## Reporting a vulnerability

**Do not open a public GitHub issue.**

- Email the team leads (contact in `README.md`) with: description, reproduction steps,
  affected component, and impact.
- If the vulnerability is in **Payaza's** infrastructure (API, dashboard, webhooks), report
  it to Payaza directly: **support@payaza.africa** / **integrationsupport@payaza.africa**,
  and tell us so we can adapt.
- We aim to acknowledge within 24 hours during the event and to fix or mitigate before any
  public demo.

## Secrets management

| Secret | Where it lives | Never |
|---|---|---|
| `PAYAZA_PUBLIC_KEY` (test & live) | Server env only (Vercel env vars) | in client bundles, git, screenshots, slides |
| `PAYAZA_SECRET_KEY` (webhook HMAC / payout signature) | Server env only | logged, sent to any third party |
| `PAYAZA_PAYOUT_PIN` (live only) | Server env only; never persisted in DB | in code, prompts, logs |
| `TYPESAFE_API_KEY` (Jev) | Server env only | client bundles |
| `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, Africa's Talking keys | Server env only | git |

Rules:

1. `.env*` is gitignored. `.env.example` contains **names only, no values**.
2. Keys are injected via the deployment platform (Vercel) — no shared key files, no keys in
   CI logs (masked variables only).
3. **Rotation:** if any key is exposed (commit, screenshot, screen-share during a demo),
   rotate immediately in the Payaza dashboard (Settings → Developers), revoke/replace
   elsewhere, and treat the exposure as an incident (log it in the audit trail).
4. During the hackathon we ship **test keys only**. Live keys require: KYB approval, server
   IP whitelisting for payouts, transaction PIN setup + PND lift (Payaza docs, Getting
   Started checklist) — tracked as a go-live gate, not a hackathon task.
5. Pre-commit secret scanning (e.g. gitleaks) is enabled in CI; a detected secret fails the
   build.

## Payment-flow security (design guarantees — see build.md §6, §12)

1. **Webhook authenticity:** every Payaza webhook is verified via `x-payaza-signature`
   (HMAC-SHA512 of the raw body with the secret key, timing-safe compare). Unverified
   payloads are rejected 401 and audit-logged.
2. **No client-side trust:** Payaza Checkout SDK callbacks are treated as *hints*. Ledger
   state changes only after server-side verification (merchant-reference transaction query
   or signature-verified webhook).
3. **Idempotency:** unique `merchant_reference` per money movement; webhook dedupe key
   (reference + status) enforced by DB unique index; retries never double-pay.
4. **Payout confirmation:** payouts respect a confirmation policy (first-time destination,
   amounts > KES 100k, or anomalous patterns flagged by Jev → OTP/dialog confirmation).
   Because Payaza account-name enquiry covers NG/GH only, we implement our own beneficiary
   echo + OTP step for KES payouts.
5. **PAN never touches our servers:** card data enters only Payaza's hosted checkout/SDK —
   we stay out of PCI-DSS scope by design.
6. **Least privilege & isolation:** all business-scoped queries filter by session
   `business_id` (`forBusiness()` helper); buyer pages expose only invoice facts behind
   unguessable ULID tokens, rate-limited.
7. **Auditability:** every money action and every AI judgment (state hash, criteria,
   probabilities, decision, overrides) appends to an immutable `audit_log`.

## AI-specific security & safety

1. **Prompt/content hygiene:** merchant-uploaded text/photos are treated as untrusted input
   to Jev. Jev returns *typed, bounded* answers (Choice/Noul/Score) — there is no
   free-text execution path; extracted values are re-validated in code (Zod) and resolved
   deterministically (no model-generated amounts or dates reach the ledger unchecked).
2. **Fail-safe defaults:** if the AI layer is unavailable or low-confidence, flows fall back
   to manual entry; risk screening fails **closed** (new buyers default to review), never
   open.
3. **Human-in-the-loop:** AI-drafted buyer communications pass a guardrail judgment and
   always require merchant approval before send.
4. **Data minimization to the model:** Jev state includes only what the judgment needs
   (order text, buyer candidates, merchant history summary) — never card data, full IDs, or
   payout credentials.

## Data protection

- Kenya Data Protection Act 2019 posture (see `docs/solution.md` §13): PII minimized,
  encrypted in transit (TLS everywhere) and at rest (Neon), retained only while the
  merchant account is active, exportable/deletable on request.
- Demo fixtures use **synthetic personas only** — no real names, phones, or transactions in
  seeds, slides, recordings, or logs (`CODE-OF-CONDUCT.md` hackathon commitments).
- Logs redact: API keys, signatures, PINs, full phone numbers (masked `07XX•••123`), and
  card-adjacent fields.

## Dependency & infrastructure security

- `pnpm audit` gate in CI (no highs/criticals); Dependabot/Renovate enabled post-hackathon.
- Deployments only via Vercel from `main`; preview URLs for PRs; `demo-freeze` tag immutable
  during judging.
- Security headers: strict CSP (allowlisting Payaza checkout domains), `frame-ancestors
  'none'` for app routes, HSTS, nosniff.
- Rate limiting on public endpoints (buyer pages, auth OTP, webhook receiver).

## Incident response (event-sized)

1. **Contain:** disable the affected flow (feature flag / Demo Mode), rotate exposed secrets.
2. **Assess:** audit log + Axiom logs; identify affected merchants/transactions.
3. **Notify:** team leads immediately; Payaza support for anything touching rails/funds;
   affected users honestly (our transparency principle applies to incidents too).
4. **Fix & verify:** patch + regression test (Playwright) before re-enabling.
5. **Log:** incident recorded in `docs/research.md` risk table follow-ups with root cause.
