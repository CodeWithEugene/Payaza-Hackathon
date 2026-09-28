import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Kusanya database schema (build.md §5).
 *
 * MONEY CONTRACT: amount columns are numeric(18,2) holding MINOR UNITS as
 * integer-valued strings ("115000" = USD 1,150.00). All math in lib/money.
 * FX rates are numeric(12,6) strings ("128.900000").
 *
 * Ids: prefixed ULIDs generated in lib/ids.ts (inv_, txn_, …). Tokens for
 * public buyer pages are unguessable ULIDs.
 */

// ---------------------------------------------------------------- enums -----

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "ready",
  "sent",
  "partially_paid",
  "paid",
  "settling",
  "settled",
  "paying_out",
  "completed",
  "failed",
  "cancelled",
  "review",
  "on_hold",
]);

export const txnKindEnum = pgEnum("txn_kind", [
  "collection",
  "payout",
  "refund",
  "split",
]);

export const txnDirectionEnum = pgEnum("txn_direction", ["in", "out"]);

export const txnChannelEnum = pgEnum("txn_channel", [
  "card",
  "apple_pay",
  "google_pay",
  "payment_link",
  "momo_ke",
  "momo_ug",
  "momo_tz",
  "mpesa_payout",
  "kepss_payout",
  "virtual_account",
  "manual",
]);

export const txnStatusEnum = pgEnum("txn_status", [
  "initialized",
  "pending",
  "completed",
  "failed",
  "reversed",
  "escrow",
]);

export const payoutConfirmationEnum = pgEnum("payout_confirmation", [
  "not_required",
  "otp_confirmed",
  "dialog_confirmed",
]);

export const splitTypeEnum = pgEnum("split_type", ["PERCENTAGE", "FLAT"]);
export const splitRailEnum = pgEnum("split_rail", ["mpesa", "bank"]);
export const payoutRailEnum = pgEnum("payout_rail", ["mpesa", "kepss_bank"]);
export const buyerKindEnum = pgEnum("buyer_kind", ["person", "company"]);
export const riskDecisionEnum = pgEnum("risk_decision", [
  "pass",
  "review",
  "hold",
]);
export const reminderChannelEnum = pgEnum("reminder_channel", [
  "email",
  "sms",
  "whatsapp",
]);
export const reminderDrafterEnum = pgEnum("reminder_drafter", [
  "template",
  "ai",
]);
export const reminderStatusEnum = pgEnum("reminder_status", [
  "draft",
  "scheduled",
  "sent",
  "cancelled",
]);
export const extractionSourceEnum = pgEnum("extraction_source", [
  "snap",
  "paste",
  "manual",
]);

// ------------------------------------------------------- better-auth tables --

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  /** Custom field: Kenyan phone (+254…) for SMS receipts & future phone-OTP. */
  phone: varchar("phone", { length: 16 }),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
    withTimezone: true,
  }),
  scope: text("scope"),
  tokenType: text("tokenType"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow(),
});

// ------------------------------------------------------------ domain tables --

export const businesses = pgTable("businesses", {
  id: text("id").primaryKey(), // biz_…
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  country: varchar("country", { length: 2 }).notNull().default("KE"),
  /** KYC tier mirrors Payaza test/live gates: 1 = small limits, 2 = full. */
  kycTier: integer("kyc_tier").notNull().default(1),
  /** Per-business human invoice number sequence (KSN-2026-0001 …). */
  invoiceSeq: integer("invoice_seq").notNull().default(0),
  settings: jsonb("settings")
    .notNull()
    .default({
      autoPayout: false,
      autoPayoutThresholdMinor: 0,
      feeBearer: "business",
      language: "en",
      notifyChannels: ["email"],
      confirmationPolicy: "always_ask",
      ai: { extraction: true, riskScreening: true, reminderDrafts: true },
    }),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const payoutRails = pgTable(
  "payout_rails",
  {
    id: text("id").primaryKey(), // rail_…
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    rail: payoutRailEnum("rail").notNull(),
    /** M-Pesa phone, intl format no '+': 2547XXXXXXXX */
    phone: varchar("phone", { length: 16 }),
    bankCode: varchar("bank_code", { length: 16 }),
    accountNumber: varchar("account_number", { length: 32 }),
    accountName: varchar("account_name", { length: 160 }),
    verified: boolean("verified").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("payout_rails_business_idx").on(t.businessId)],
);

export const buyers = pgTable(
  "buyers",
  {
    id: text("id").primaryKey(), // buy_…
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: buyerKindEnum("kind").notNull().default("company"),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 254 }),
    phone: varchar("phone", { length: 16 }),
    country: varchar("country", { length: 2 }).notNull().default("KE"),
    notes: text("notes"),
    riskFlags: jsonb("risk_flags").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("buyers_business_idx").on(t.businessId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(), // inv_…
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => buyers.id),
    /** Human number: KSN-2026-0042 — unique per business. */
    number: varchar("number", { length: 24 }).notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull(), // USD|KES|UGX|TZS
    /** Minor units, numeric(18,2) integer-valued string. */
    amountMinor: numeric("amount_minor", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    fxRate: numeric("fx_rate", { precision: 12, scale: 6 }),
    fxQuoteExpiresAt: timestamp("fx_quote_expires_at", { withTimezone: true }),
    feeBearer: varchar("fee_bearer", { length: 8 })
      .notNull()
      .default("business"), // business | customer
    dueAt: timestamp("due_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    /** Public unguessable token for /i/[token]. */
    token: varchar("token", { length: 40 }).notNull(),
    payazaLinkId: varchar("payaza_link_id", { length: 64 }),
    payazaLinkUrl: text("payaza_link_url"),
    checkoutSessionRef: varchar("checkout_session_ref", { length: 64 }),
    aiMeta: jsonb("ai_meta"), // {source, extractionId, qualityScore}
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_token_idx").on(t.token),
    uniqueIndex("invoices_business_number_idx").on(t.businessId, t.number),
    index("invoices_business_status_idx").on(t.businessId, t.status),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: text("id").primaryKey(), // itm_…
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull().default("1"),
    /** Minor units per 1 qty. */
    unitPriceMinor: numeric("unit_price_minor", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 3 }).notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(), // txn_…
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").references(() => invoices.id),
    kind: txnKindEnum("kind").notNull(),
    direction: txnDirectionEnum("direction").notNull(),
    /** Ours — unique, carried to Payaza as transaction_reference. */
    merchantReference: varchar("merchant_reference", { length: 40 }).notNull(),
    payazaReference: varchar("payaza_reference", { length: 64 }),
    channel: txnChannelEnum("channel").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountMinor: numeric("amount_minor", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    feeMinor: numeric("fee_minor", { precision: 18, scale: 2 }),
    netMinor: numeric("net_minor", { precision: 18, scale: 2 }),
    fxRate: numeric("fx_rate", { precision: 12, scale: 6 }),
    status: txnStatusEnum("status").notNull().default("initialized"),
    /** Raw Payaza status string for audit (NIP_SUCCESS, Funds Received, …). */
    payazaStatusRaw: varchar("payaza_status_raw", { length: 48 }),
    /** Redacted raw payload (never PAN/keys) — audit + demo fixtures. */
    payload: jsonb("payload"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("transactions_merchant_reference_idx").on(
      t.merchantReference,
    ),
    index("transactions_business_created_idx").on(t.businessId, t.createdAt),
    index("transactions_invoice_idx").on(t.invoiceId),
  ],
);

export const payouts = pgTable("payouts", {
  id: text("id").primaryKey(), // pay_…
  /** 1:1 with its transactions row. */
  transactionId: text("transaction_id")
    .notNull()
    .unique()
    .references(() => transactions.id, { onDelete: "cascade" }),
  railId: text("rail_id")
    .notNull()
    .references(() => payoutRails.id),
  beneficiaryName: varchar("beneficiary_name", { length: 160 }).notNull(),
  /** Full value server-side; UI masks via lib/ids.mask(). */
  beneficiaryAccount: varchar("beneficiary_account", { length: 40 }).notNull(),
  amountMinorKes: numeric("amount_minor_kes", { precision: 18, scale: 2 })
    .notNull()
    .default("0"),
  confirmation: payoutConfirmationEnum("confirmation")
    .notNull()
    .default("not_required"),
  /** Server-only flag: live payout PIN was applied (never store the PIN). */
  pinUsed: boolean("pin_used").notNull().default(false),
  batchReference: varchar("batch_reference", { length: 64 }),
  status: txnStatusEnum("status").notNull().default("initialized"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const splitBeneficiaries = pgTable(
  "split_beneficiaries",
  {
    id: text("id").primaryKey(), // spb_…
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 254 }),
    accountNo: varchar("account_no", { length: 40 }).notNull(),
    bankCode: varchar("bank_code", { length: 16 }),
    rail: splitRailEnum("rail").notNull().default("mpesa"),
    splitType: splitTypeEnum("split_type").notNull().default("PERCENTAGE"),
    /**
     * ⚠️ PAYAZA SEMANTICS (research §4.4): split_value is what the PLATFORM
     * KEEPS — not what the beneficiary receives! For PERCENTAGE, beneficiary
     * gets (100 - split_value)%. The partners UI surfaces this inversion
     * explicitly (build.md §8.11).
     */
    splitValue: numeric("split_value", { precision: 8, scale: 4 })
      .notNull()
      .default("0"),
    /** SSA_… code — goes into Checkout SDK split_accounts. */
    payazaSplitCode: varchar("payaza_split_code", { length: 40 }),
    /** Numeric id — required for update/delete API calls. */
    payazaSplitId: varchar("payaza_split_id", { length: 40 }),
    active: boolean("active").notNull().default(true),
    /** Fallback leg when Payaza splits reject KES beneficiaries (risk R2). */
    fallbackPayoutRailId: text("fallback_payout_rail_id").references(
      () => payoutRails.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("split_beneficiaries_business_idx").on(t.businessId)],
);

export const invoiceSplits = pgTable(
  "invoice_splits",
  {
    id: text("id").primaryKey(), // isp_…
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    beneficiaryId: text("beneficiary_id")
      .notNull()
      .references(() => splitBeneficiaries.id),
    sharePct: numeric("share_pct", { precision: 8, scale: 4 }),
    expectedAmountMinor: numeric("expected_amount_minor", {
      precision: 18,
      scale: 2,
    }),
    settledAmountMinor: numeric("settled_amount_minor", {
      precision: 18,
      scale: 2,
    }),
  },
  (t) => [index("invoice_splits_invoice_idx").on(t.invoiceId)],
);

export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: text("id").primaryKey(), // rsk_…
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    compositeScore: integer("composite_score").notNull(), // 0–100
    decision: riskDecisionEnum("decision").notNull(),
    /** [{label, probability, criterion}] — reason chips + hovercard copy. */
    reasons: jsonb("reasons").notNull().default([]),
    /** TypeSafe answer id for the audit trail. */
    jevAnswerId: varchar("jev_answer_id", { length: 80 }),
    /** True when Jev was unavailable → fail-safe default (review/hold). */
    fallback: boolean("fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("risk_assessments_invoice_idx").on(t.invoiceId)],
);

export const aiExtractions = pgTable(
  "ai_extractions",
  {
    id: text("id").primaryKey(), // ext_…
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    sourceType: extractionSourceEnum("source_type").notNull(),
    sourceText: text("source_text"),
    photoUrl: text("photo_url"),
    jevRequest: jsonb("jev_request"),
    jevResponse: jsonb("jev_response"),
    quality: numeric("quality", { precision: 4, scale: 3 }), // 0.000–1.000
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_extractions_business_idx").on(t.businessId)],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(), // wev_…
    eventKind: varchar("event_kind", { length: 48 }).notNull(),
    transactionReference: varchar("transaction_reference", { length: 64 }),
    signatureValid: boolean("signature_valid").notNull(),
    /** reference + status — unique: duplicates are ack'd, never reprocessed. */
    dedupeKey: varchar("dedupe_key", { length: 160 }).notNull(),
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("webhook_events_dedupe_idx").on(t.dedupeKey),
    index("webhook_events_reference_idx").on(t.transactionReference),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: text("id").primaryKey(), // rem_…
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    channel: reminderChannelEnum("channel").notNull().default("email"),
    body: text("body"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    draftedBy: reminderDrafterEnum("drafted_by").notNull().default("template"),
    /** Guardrail judgment snapshot (claims checked, probabilities). */
    guardrail: jsonb("guardrail"),
    status: reminderStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("reminders_invoice_idx").on(t.invoiceId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(), // aud_…
    /** user id, "system", or "jev". */
    actor: varchar("actor", { length: 80 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 60 }).notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    /** Reference into ai_extractions / risk_assessments for AI actions. */
    aiRef: varchar("ai_ref", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entityType, t.entityId)],
);

// --------------------------------------------------------------- telegram ---

/**
 * Telegram chats linked to a Kusanya user. Keyed by the user's EMAIL (no FK)
 * on purpose: the demo reset deletes and recreates the demo user, and a judge's
 * linked chat must survive that. Business is resolved at message time.
 */
export const telegramLinks = pgTable(
  "telegram_links",
  {
    id: text("id").primaryKey(), // tgl_…
    chatId: varchar("chat_id", { length: 32 }).notNull(),
    userEmail: varchar("user_email", { length: 255 }).notNull(),
    username: varchar("username", { length: 64 }),
    firstName: varchar("first_name", { length: 128 }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("telegram_links_chat_idx").on(t.chatId), index("telegram_links_email_idx").on(t.userEmail)],
);

/** One-time deep-link codes (t.me/<bot>?start=<code>), 15 minute lifetime. */
export const telegramLinkCodes = pgTable("telegram_link_codes", {
  code: varchar("code", { length: 64 }).primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// --------------------------------------------------------------- relations --

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  user: one(users, { fields: [businesses.userId], references: [users.id] }),
  invoices: many(invoices),
  buyers: many(buyers),
  payoutRails: many(payoutRails),
  splitBeneficiaries: many(splitBeneficiaries),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  business: one(businesses, {
    fields: [invoices.businessId],
    references: [businesses.id],
  }),
  buyer: one(buyers, { fields: [invoices.buyerId], references: [buyers.id] }),
  items: many(invoiceItems),
  transactions: many(transactions),
  splits: many(invoiceSplits),
  riskAssessments: many(riskAssessments),
  reminders: many(reminders),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  business: one(businesses, {
    fields: [transactions.businessId],
    references: [businesses.id],
  }),
  invoice: one(invoices, {
    fields: [transactions.invoiceId],
    references: [invoices.id],
  }),
  payout: one(payouts, {
    fields: [transactions.id],
    references: [payouts.transactionId],
  }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  transaction: one(transactions, {
    fields: [payouts.transactionId],
    references: [transactions.id],
  }),
  rail: one(payoutRails, {
    fields: [payouts.railId],
    references: [payoutRails.id],
  }),
}));

export const buyersRelations = relations(buyers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [buyers.businessId],
    references: [businesses.id],
  }),
  invoices: many(invoices),
}));

export const invoiceSplitsRelations = relations(invoiceSplits, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceSplits.invoiceId],
    references: [invoices.id],
  }),
  beneficiary: one(splitBeneficiaries, {
    fields: [invoiceSplits.beneficiaryId],
    references: [splitBeneficiaries.id],
  }),
}));

export const riskAssessmentsRelations = relations(riskAssessments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [riskAssessments.invoiceId],
    references: [invoices.id],
  }),
}));

// ----------------------------------------------------------------- exports --

export const schema = {
  users,
  sessions,
  accounts,
  verifications,
  businesses,
  payoutRails,
  buyers,
  invoices,
  invoiceItems,
  transactions,
  payouts,
  splitBeneficiaries,
  invoiceSplits,
  riskAssessments,
  aiExtractions,
  webhookEvents,
  reminders,
  auditLog,
};

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Buyer = typeof buyers.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type SplitBeneficiary = typeof splitBeneficiaries.$inferSelect;
export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type AiExtraction = typeof aiExtractions.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type PayoutRail = typeof payoutRails.$inferSelect;
