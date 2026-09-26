import "server-only";
import { eq, inArray, like } from "drizzle-orm";
import { db, ensureSchema } from "@/lib/db/client";
import {
  aiExtractions,
  businesses,
  buyers,
  invoiceItems,
  invoiceSplits,
  invoices,
  payoutRails,
  payouts,
  reminders,
  riskAssessments,
  splitBeneficiaries,
  transactions,
  users,
  webhookEvents,
} from "@/lib/db/schema";
import { newId, newMerchantReference } from "@/lib/ids";
import { toNumericColumn } from "@/lib/money/format";
import { buildWaterfall, feePercent, KUSANYA_TAKE_BPS } from "@/lib/money/fees";
import { writeAudit } from "@/lib/db/audit";
import { DEMO_PAYOUT_CODE } from "@/lib/services/payouts";

/**
 * Demo Mode seed (build.md §14) — the Wanjiru / FreshLeaf Exports story with
 * a complete 45-day ledger: every invoice state the judges need to see, real
 * waterfall math, risk queue cases, reminders, and an audit trail.
 *
 * Deterministic + idempotent: wipes the demo business (FK cascade) and reseeds.
 * Login: wanjiru@kusanya.demo / kusanya-demo-2026 (documented in .env.example).
 */

export const DEMO_EMAIL = "wanjiru@kusanya.demo";
export const DEMO_PASSWORD = "kusanya-demo-2026";
export const DEMO_SLUG = "freshleaf-demo";

const DAY = 24 * 3600 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

export async function seedDemo(): Promise<{ businessId: string; invoiceIds: Record<string, string> }> {
  await ensureSchema();
  await wipeDemo();

  // ---- user (password hashed by better-auth) ----
  const { auth } = await import("@/lib/auth/config");
  const signedUp = await auth.api.signUpEmail({
    body: { name: "Wanjiru Kamau", email: DEMO_EMAIL, password: DEMO_PASSWORD },
    headers: new Headers(),
  });
  const userId = signedUp.user.id;
  await db.update(users).set({ phone: "+254700111222" }).where(eq(users.id, userId));

  // ---- business ----
  const businessId = newId("biz");
  await db.insert(businesses).values({
    id: businessId,
    userId,
    name: "FreshLeaf Exports Ltd",
    slug: DEMO_SLUG,
    country: "KE",
    kycTier: 2,
    invoiceSeq: 6,
    settings: {
      autoPayout: false,
      autoPayoutThresholdMinor: 0,
      feeBearer: "business",
      language: "en",
      notifyChannels: ["email", "sms"],
      confirmationPolicy: "always_ask",
      ai: { extraction: true, riskScreening: true, reminderDrafts: true },
    },
  });

  // ---- payout rails ----
  const railMpesa = newId("rail");
  const railBank = newId("rail");
  await db.insert(payoutRails).values([
    {
      id: railMpesa,
      businessId,
      rail: "mpesa",
      phone: "254700111222",
      accountName: "Wanjiru Kamau",
      verified: true,
      isDefault: true,
    },
    {
      id: railBank,
      businessId,
      rail: "kepss_bank",
      accountNumber: "0451234567890",
      accountName: "FreshLeaf Exports Ltd",
      bankCode: "000018",
      verified: true,
      isDefault: false,
    },
  ]);

  // ---- buyers ----
  const bDubai = newId("buy");
  const bGlobal = newId("buy");
  const bNjeri = newId("buy");
  const bAmani = newId("buy");
  const bNordic = newId("buy");
  const bKato = newId("buy");
  await db.insert(buyers).values([
    { id: bDubai, businessId, kind: "company", name: "Dubai Fresh FZE", email: "susan@dubaifresh.ae", phone: "+971501234567", country: "AE", createdAt: daysAgo(38) },
    { id: bGlobal, businessId, kind: "company", name: "Global Foods LLC", email: "ap@globalfoods.com", country: "US", createdAt: daysAgo(21) },
    { id: bNjeri, businessId, kind: "company", name: "Mama Njeri Green Grocers", email: "njeri@greengrocers.co.ke", phone: "+254722111333", country: "KE", createdAt: daysAgo(30) },
    { id: bAmani, businessId, kind: "company", name: "Amani Foods Ltd", email: "orders@amanifoods.co.tz", phone: "+255754123456", country: "TZ", createdAt: daysAgo(16) },
    { id: bNordic, businessId, kind: "company", name: "Nordic Seafood AS", email: "post@nordicseafood.example", country: "NO", createdAt: daysAgo(1) },
    { id: bKato, businessId, kind: "company", name: "Kato Grocers", email: "kato@katogrocers.ug", phone: "+256772123456", country: "UG", createdAt: daysAgo(9) },
  ]);

  // ---- partner (agent split) — splitValue is the INVERTED platform-keep ----
  const partnerId = newId("spb");
  await db.insert(splitBeneficiaries).values({
    id: partnerId,
    businessId,
    name: "Mwalimu Logistics Ltd",
    email: "accounts@mwalimulogistics.co.ke",
    accountNo: "254733987654",
    bankCode: "SAFKEN",
    rail: "mpesa",
    splitType: "PERCENTAGE",
    splitValue: "97.5", // platform keeps 97.5% → partner receives 2.5%
    payazaSplitCode: "SSA_C0900E891783950401871",
    payazaSplitId: "114",
    active: true,
  });

  const ids: Record<string, string> = {};

  // ================================================== inv1 — COMPLETED ====
  // USD 1,150.00 French beans → Dubai Fresh: paid by card, settled, paid out
  // to M-Pesa with the 2.5% agent split — the full transparency story.
  {
    const id = newId("inv");
    ids.completed = id;
    const gross = 115000; // USD minor
    const railFee = feePercent(gross, 1.9); // 2185
    await db.insert(invoices).values({
      id,
      businessId,
      buyerId: bDubai,
      number: "KSN-2026-0001",
      status: "completed",
      currency: "USD",
      amountMinor: toNumericColumn(gross),
      fxRate: "128.900000",
      feeBearer: "business",
      dueAt: daysAgo(9),
      issuedAt: daysAgo(14),
      token: newPublicTokenSafe(),
      payazaLinkId: "84021",
      payazaLinkUrl: "https://business.payaza.africa/pay/ksn-demo-0001",
      aiMeta: { source: "paste", demo: true },
      notes: "French beans, air-freight JKIA → DXB. Certificate of origin attached.",
      createdAt: daysAgo(14),
      updatedAt: daysAgo(9),
    });
    await db.insert(invoiceItems).values([
      { id: newId("itm"), invoiceId: id, currency: "USD", description: "French beans (kg)", qty: "500", unitPriceMinor: toNumericColumn(230), position: 0 },
    ]);
    const txnIn = newId("txn");
    await db.insert(transactions).values({
      id: txnIn,
      businessId,
      invoiceId: id,
      kind: "collection",
      direction: "in",
      merchantReference: newMerchantReference(),
      payazaReference: "PZ9012345678",
      channel: "card",
      currency: "USD",
      amountMinor: toNumericColumn(gross),
      feeMinor: toNumericColumn(railFee),
      netMinor: toNumericColumn(gross - railFee),
      status: "completed",
      payazaStatusRaw: "Funds Received:Payment Approved",
      payload: { demo: true, channel: "Card", amount_validation: "EXACT" },
      occurredAt: daysAgo(12),
      createdAt: daysAgo(12),
    });

    // Waterfall (same math the live UI shows) → payout amount.
    const lines = buildWaterfall(
      {
        grossMinor: gross,
        railFeeMinor: railFee,
        kusanyaFeeBps: KUSANYA_TAKE_BPS,
        fxRate: "128.900000",
        settleCurrency: "KES",
        splits: [{ name: "Mwalimu Logistics Ltd", bpsOrMinor: { kind: "bps", value: 250 } }],
      },
      "USD",
      false,
    );
    const netKES = lines.find((l) => l.kind === "net")!.minor;
    const payoutFee = feePercent(netKES, 1.0);
    const payoutMinor = netKES - payoutFee;

    const txnOut = newId("txn");
    const payoutId = newId("pay");
    await db.insert(transactions).values({
      id: txnOut,
      businessId,
      invoiceId: id,
      kind: "payout",
      direction: "out",
      merchantReference: newMerchantReference(),
      payazaReference: `PTSA${Date.now()}`,
      channel: "mpesa_payout",
      currency: "KES",
      amountMinor: toNumericColumn(payoutMinor),
      feeMinor: toNumericColumn(1500), // M-Pesa disbursement
      netMinor: toNumericColumn(payoutMinor - 1500),
      status: "completed",
      payazaStatusRaw: "NIP_SUCCESS:00",
      occurredAt: daysAgo(9),
      createdAt: daysAgo(9),
    });
    await db.insert(payouts).values({
      id: payoutId,
      transactionId: txnOut,
      railId: railMpesa,
      beneficiaryName: "Wanjiru Kamau",
      beneficiaryAccount: "254700111222",
      amountMinorKes: toNumericColumn(payoutMinor),
      confirmation: "otp_confirmed",
      pinUsed: false,
      status: "completed",
      createdAt: daysAgo(9),
    });
    await db.insert(invoiceSplits).values({
      id: newId("isp"),
      invoiceId: id,
      beneficiaryId: partnerId,
      sharePct: "2.5",
      expectedAmountMinor: toNumericColumn(Math.round((netKES * 2.5) / 100)),
      settledAmountMinor: toNumericColumn(Math.round((netKES * 2.5) / 100)),
    });
    await db.insert(webhookEvents).values({
      id: newId("wev"),
      eventKind: "collection",
      transactionReference: "PZ9012345678",
      signatureValid: true,
      dedupeKey: `seed:collection:PZ9012345678:Funds Received`,
      payload: { demo: true, transaction_status: "Funds Received", amount_received: 1150, currency_code: "USD", channel: "Card", amount_validation: "EXACT" },
      processed: true,
      receivedAt: daysAgo(12),
    });
    // The source message + extraction record behind this invoice.
    const extId = newId("ext");
    await db.insert(aiExtractions).values({
      id: extId,
      businessId,
      sourceType: "paste",
      sourceText:
        "Hi Wanjiru, please send us 500kg of French beans at USD 2.30 per kg, total USD 1,150. Ship to Dubai Fresh FZE, payment by card within 5 days. attn Susan Kamau",
      jevRequest: { model: "demo-rules-v1", seeded: true },
      jevResponse: { mode: "rule-fallback", seeded: true, fields: { total: 115000, currency: "USD", dueInDays: 5 } },
      quality: "0.940",
      durationMs: 320,
      createdAt: daysAgo(14),
    });
    await writeAudit({
      actor: "system:seed",
      action: "invoice.completed_history",
      entityType: "invoices",
      entityId: id,
      after: { payoutMinor, netKES, splitPartner: "Mwalimu Logistics Ltd" },
      aiRef: extId,
    });
  }

  // ==================================================== inv2 — PAID =======
  // USD 2,300.00 avocados → Global Foods LLC: card paid yesterday, awaiting
  // Payaza settlement (T+3–5) — shows honest ETA state.
  {
    const id = newId("inv");
    ids.paid = id;
    const gross = 230000;
    await db.insert(invoices).values({
      id,
      businessId,
      buyerId: bGlobal,
      number: "KSN-2026-0002",
      status: "paid",
      currency: "USD",
      amountMinor: toNumericColumn(gross),
      feeBearer: "business",
      dueAt: daysAgo(-3),
      issuedAt: daysAgo(4),
      token: newPublicTokenSafe(),
      payazaLinkUrl: "https://business.payaza.africa/pay/ksn-demo-0002",
      createdAt: daysAgo(4),
      updatedAt: daysAgo(1),
    });
    await db.insert(invoiceItems).values([
      { id: newId("itm"), invoiceId: id, currency: "USD", description: "Hass avocados, grade 1 (cartons)", qty: "230", unitPriceMinor: toNumericColumn(1000), position: 0 },
    ]);
    await db.insert(transactions).values({
      id: newId("txn"),
      businessId,
      invoiceId: id,
      kind: "collection",
      direction: "in",
      merchantReference: newMerchantReference(),
      payazaReference: "PZ9012345999",
      channel: "card",
      currency: "USD",
      amountMinor: toNumericColumn(gross),
      feeMinor: toNumericColumn(feePercent(gross, 1.9)),
      netMinor: toNumericColumn(gross - feePercent(gross, 1.9)),
      status: "completed",
      payazaStatusRaw: "Funds Received:Payment Approved",
      occurredAt: daysAgo(1),
      createdAt: daysAgo(1),
    });
  }

  // ==================================================== inv3 — SENT =======
  // KES 48,500 → Mama Njeri (local momo): prompt pending — the live
  // demo-replay target ("simulate payment" buttons on this invoice).
  {
    const id = newId("inv");
    ids.sent = id;
    const gross = 4850000; // KES 48,500.00
    await db.insert(invoices).values({
      id,
      businessId,
      buyerId: bNjeri,
      number: "KSN-2026-0003",
      status: "sent",
      currency: "KES",
      amountMinor: toNumericColumn(gross),
      feeBearer: "business",
      dueAt: daysAgo(-5),
      issuedAt: daysAgo(2),
      token: newPublicTokenSafe(),
      payazaLinkUrl: "https://business.payaza.africa/pay/ksn-demo-0003",
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    });
    await db.insert(invoiceItems).values([
      { id: newId("itm"), invoiceId: id, currency: "KES", description: "Manila green peppers (kg)", qty: "650", unitPriceMinor: toNumericColumn(6308), position: 0 },
      { id: newId("itm"), invoiceId: id, currency: "KES", description: "Kale, graded (kg)", qty: "240", unitPriceMinor: toNumericColumn(3125), position: 1 },
    ]);
    const txnId = newId("txn");
    const ref = newMerchantReference();
    ids.sentTxnRef = ref;
    await db.insert(transactions).values({
      id: txnId,
      businessId,
      invoiceId: id,
      kind: "collection",
      direction: "in",
      merchantReference: ref,
      channel: "momo_ke",
      currency: "KES",
      amountMinor: toNumericColumn(gross),
      status: "pending",
      payazaStatusRaw: "09:PENDING",
      occurredAt: daysAgo(0.1),
      createdAt: daysAgo(0.1),
    });
    await db.insert(reminders).values([
      { id: newId("rem"), invoiceId: id, channel: "email", body: `Hi! A quick heads-up: invoice KSN-2026-0003 for KES 48,500.00 is due on ${daysAgo(-5).toISOString().slice(0, 10)}. Pay in ~2 minutes via M-Pesa.`, scheduledAt: daysAgo(-2), draftedBy: "template", status: "scheduled" },
      { id: newId("rem"), invoiceId: id, channel: "sms", body: `KUSANYA: Invoice KSN-2026-0003 for KES 48,500.00 is due on ${daysAgo(-5).toISOString().slice(0, 10)}. Lipa kwa M-Pesa.`, scheduledAt: daysAgo(-5), draftedBy: "template", status: "scheduled" },
    ]);
  }

  // ================================================== inv4 — REVIEW =======
  // USD 9,800 first-time buyer, 3× their… no history + high amount → composite
  // 55 → review queue (judge-facing trust demo).
  {
    const id = newId("inv");
    ids.review = id;
    await db.insert(invoices).values({
      id,
      businessId,
      buyerId: bNordic,
      number: "KSN-2026-0004",
      status: "review",
      currency: "USD",
      amountMinor: toNumericColumn(980000),
      feeBearer: "business",
      dueAt: daysAgo(-10),
      token: newPublicTokenSafe(),
      notes: "First order, unusually large. Verifying buyer before sending.",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    });
    await db.insert(riskAssessments).values({
      id: newId("rsk"),
      invoiceId: id,
      compositeScore: 55,
      decision: "review",
      reasons: [
        { key: "sanctions", label: "Sanctions / prohibited-goods language", probability: 0.02, weight: 40, criterion: "Text screened for trade-control evasion and prohibited goods" },
        { key: "anomaly", label: "Amount anomaly vs buyer history", probability: 0.95, weight: 20, criterion: "No history — amount far above merchant average" },
        { key: "first", label: "First-time buyer", probability: 1, weight: 15, criterion: "No prior settled invoices with this buyer (deterministic fact)" },
        { key: "jurisdiction", label: "Jurisdiction risk", probability: 0.05, weight: 15, criterion: "Buyer country NO not on elevated-review list" },
        { key: "mismatch", label: "Name mismatch", probability: 0.2, weight: 10, criterion: "Presented name diverges slightly from directory name" },
      ],
      fallback: true,
      createdAt: daysAgo(1),
    });
  }

  // ============================================ inv5 — PARTIALLY PAID ======
  // USD 3,450 → Dubai Fresh: UNDERPAYMENT (85%) — merchant alert + remaining
  // balance flow.
  {
    const id = newId("inv");
    ids.partial = id;
    const gross = 345000;
    const received = 293250; // 85%
    const fee = feePercent(received, 1.9);
    await db.insert(invoices).values({
      id,
      businessId,
      buyerId: bDubai,
      number: "KSN-2026-0005",
      status: "partially_paid",
      currency: "USD",
      amountMinor: toNumericColumn(gross),
      feeBearer: "business",
      dueAt: daysAgo(-1),
      issuedAt: daysAgo(6),
      token: newPublicTokenSafe(),
      createdAt: daysAgo(6),
      updatedAt: daysAgo(3),
    });
    await db.insert(transactions).values({
      id: newId("txn"),
      businessId,
      invoiceId: id,
      kind: "collection",
      direction: "in",
      merchantReference: newMerchantReference(),
      payazaReference: "PZ9012346123",
      channel: "card",
      currency: "USD",
      amountMinor: toNumericColumn(received),
      feeMinor: toNumericColumn(fee),
      netMinor: toNumericColumn(received - fee),
      status: "completed",
      payazaStatusRaw: "Funds Received:UNDERPAYMENT",
      payload: { demo: true, amount_validation: "UNDERPAYMENT", request_amount: 3450, amount_received: 2932.5 },
      occurredAt: daysAgo(3),
      createdAt: daysAgo(3),
    });
  }

  // ================================================== inv6 — ON HOLD ======
  // Sanctions language hit → 82 → hold (fail-closed demo).
  {
    const id = newId("inv");
    ids.hold = id;
    await db.insert(invoices).values({
      id,
      businessId,
      buyerId: bKato,
      number: "KSN-2026-0006",
      status: "on_hold",
      currency: "USD",
      amountMinor: toNumericColumn(4100000),
      feeBearer: "business",
      token: newPublicTokenSafe(),
      notes: "Message mentioned routing dual-use equipment via a third country. Held for compliance.",
      createdAt: daysAgo(0.5),
      updatedAt: daysAgo(0.5),
    });
    await db.insert(riskAssessments).values({
      id: newId("rsk"),
      invoiceId: id,
      compositeScore: 82,
      decision: "hold",
      reasons: [
        { key: "sanctions", label: "Sanctions / prohibited-goods language", probability: 0.95, weight: 40, criterion: "Text screened for trade-control evasion and prohibited goods" },
        { key: "anomaly", label: "Amount anomaly vs buyer history", probability: 0.9, weight: 20, criterion: "Total more than ~30% above this buyer's historical average" },
        { key: "first", label: "First-time buyer", probability: 0, weight: 15, criterion: "Repeat buyer (deterministic fact)" },
        { key: "jurisdiction", label: "Jurisdiction risk", probability: 0.05, weight: 15, criterion: "Buyer country UG not on elevated-review list" },
        { key: "mismatch", label: "Name mismatch", probability: 0.1, weight: 10, criterion: "Presented name diverges from directory name" },
      ],
      fallback: true,
      createdAt: daysAgo(0.5),
    });
  }

  // ---- analytics filler: older settled invoices (charts need history) ----
  const history = [
    { n: "KSN-2026-0000A", buyer: bDubai, cur: "USD", minor: 98000, days: 33 },
    { n: "KSN-2026-0000B", buyer: bAmani, cur: "TZS", minor: 3200000, days: 27 },
    { n: "KSN-2026-0000C", buyer: bDubai, cur: "USD", minor: 121500, days: 20 },
    { n: "KSN-2026-0000D", buyer: bGlobal, cur: "USD", minor: 87000, days: 15 },
    { n: "KSN-2026-0000E", buyer: bKato, cur: "UGX", minor: 5400000, days: 8 },
  ];
  for (const h of history) {
    const id = newId("inv");
    await db.insert(invoices).values({
      id,
      businessId,
      buyerId: h.buyer,
      number: h.n,
      status: "completed",
      currency: h.cur,
      amountMinor: toNumericColumn(h.minor),
      feeBearer: "business",
      dueAt: daysAgo(h.days - 4),
      issuedAt: daysAgo(h.days),
      token: newPublicTokenSafe(),
      createdAt: daysAgo(h.days),
      updatedAt: daysAgo(h.days - 4),
    });
    await db.insert(transactions).values({
      id: newId("txn"),
      businessId,
      invoiceId: id,
      kind: "collection",
      direction: "in",
      merchantReference: newMerchantReference(),
      channel: h.cur === "USD" ? "card" : h.cur === "TZS" ? "momo_tz" : h.cur === "UGX" ? "momo_ug" : "momo_ke",
      currency: h.cur,
      amountMinor: toNumericColumn(h.minor),
      feeMinor: toNumericColumn(feePercent(h.minor, 1.9)),
      netMinor: toNumericColumn(h.minor - feePercent(h.minor, 1.9)),
      status: "completed",
      payazaStatusRaw: "Funds Received",
      occurredAt: daysAgo(h.days - 2),
      createdAt: daysAgo(h.days - 2),
    });
  }

  await writeAudit({
    actor: "system:seed",
    action: "demo.seeded",
    entityType: "businesses",
    entityId: businessId,
    after: { invoices: 11, demoPayoutCode: DEMO_PAYOUT_CODE },
  });

  return { businessId, invoiceIds: ids };
}

/**
 * Wipe demo business + user in FK-safe order. Cascades alone race: payouts
 * reference BOTH transactions (cascade) and payoutRails (no cascade), and
 * invoiceSplits reference splitBeneficiaries without cascade — so children
 * are deleted explicitly, deepest first.
 */
export async function wipeDemo() {
  const [biz] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, DEMO_SLUG)).limit(1);
  if (biz) {
    const invoiceIds = db.select({ id: invoices.id }).from(invoices).where(eq(invoices.businessId, biz.id));
    const txnIds = db.select({ id: transactions.id }).from(transactions).where(eq(transactions.businessId, biz.id));
    await db.delete(invoiceSplits).where(inArray(invoiceSplits.invoiceId, invoiceIds));
    await db.delete(reminders).where(inArray(reminders.invoiceId, invoiceIds));
    await db.delete(riskAssessments).where(inArray(riskAssessments.invoiceId, invoiceIds));
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
    await db.delete(payouts).where(inArray(payouts.transactionId, txnIds));
    await db.delete(transactions).where(eq(transactions.businessId, biz.id));
    await db.delete(invoices).where(eq(invoices.businessId, biz.id));
    await db.delete(splitBeneficiaries).where(eq(splitBeneficiaries.businessId, biz.id));
    await db.delete(payoutRails).where(eq(payoutRails.businessId, biz.id));
    await db.delete(buyers).where(eq(buyers.businessId, biz.id));
    await db.delete(aiExtractions).where(eq(aiExtractions.businessId, biz.id));
    await db.delete(webhookEvents).where(like(webhookEvents.dedupeKey, "seed:%"));
    await db.delete(businesses).where(eq(businesses.id, biz.id));
  }
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (u) await db.delete(users).where(eq(users.id, u.id)); // sessions/accounts cascade
}

/** Reset = wipe + seed (demo reset button / API). */
export async function resetDemo() {
  return seedDemo();
}

function newPublicTokenSafe() {
  // Local import avoids pulling ids' randomness helpers twice.
  return `tok_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
