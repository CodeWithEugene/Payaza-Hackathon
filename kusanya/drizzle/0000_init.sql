CREATE TYPE "public"."buyer_kind" AS ENUM('person', 'company');--> statement-breakpoint
CREATE TYPE "public"."extraction_source" AS ENUM('snap', 'paste', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'ready', 'sent', 'partially_paid', 'paid', 'settling', 'settled', 'paying_out', 'completed', 'failed', 'cancelled', 'review', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."payout_confirmation" AS ENUM('not_required', 'otp_confirmed', 'dialog_confirmed');--> statement-breakpoint
CREATE TYPE "public"."payout_rail" AS ENUM('mpesa', 'kepss_bank');--> statement-breakpoint
CREATE TYPE "public"."reminder_channel" AS ENUM('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."reminder_drafter" AS ENUM('template', 'ai');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('draft', 'scheduled', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."risk_decision" AS ENUM('pass', 'review', 'hold');--> statement-breakpoint
CREATE TYPE "public"."split_rail" AS ENUM('mpesa', 'bank');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('PERCENTAGE', 'FLAT');--> statement-breakpoint
CREATE TYPE "public"."txn_channel" AS ENUM('card', 'apple_pay', 'google_pay', 'payment_link', 'momo_ke', 'momo_ug', 'momo_tz', 'mpesa_payout', 'kepss_payout', 'virtual_account', 'manual');--> statement-breakpoint
CREATE TYPE "public"."txn_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."txn_kind" AS ENUM('collection', 'payout', 'refund', 'split');--> statement-breakpoint
CREATE TYPE "public"."txn_status" AS ENUM('initialized', 'pending', 'completed', 'failed', 'reversed', 'escrow');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"tokenType" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_extractions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"source_type" "extraction_source" NOT NULL,
	"source_text" text,
	"photo_url" text,
	"jev_request" jsonb,
	"jev_response" jsonb,
	"quality" numeric(4, 3),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" varchar(80) NOT NULL,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" varchar(60) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ai_ref" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"country" varchar(2) DEFAULT 'KE' NOT NULL,
	"kyc_tier" integer DEFAULT 1 NOT NULL,
	"invoice_seq" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{"autoPayout":false,"autoPayoutThresholdMinor":0,"feeBearer":"business","language":"en","notifyChannels":["email"],"confirmationPolicy":"always_ask","ai":{"extraction":true,"riskScreening":true,"reminderDrafts":true}}'::jsonb NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" "buyer_kind" DEFAULT 'company' NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(254),
	"phone" varchar(16),
	"country" varchar(2) DEFAULT 'KE' NOT NULL,
	"notes" text,
	"risk_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"qty" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price_minor" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_splits" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"beneficiary_id" text NOT NULL,
	"share_pct" numeric(8, 4),
	"expected_amount_minor" numeric(18, 2),
	"settled_amount_minor" numeric(18, 2)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"number" varchar(24) NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" numeric(18, 2) DEFAULT '0' NOT NULL,
	"fx_rate" numeric(12, 6),
	"fx_quote_expires_at" timestamp with time zone,
	"fee_bearer" varchar(8) DEFAULT 'business' NOT NULL,
	"due_at" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"token" varchar(40) NOT NULL,
	"payaza_link_id" varchar(64),
	"payaza_link_url" text,
	"checkout_session_ref" varchar(64),
	"ai_meta" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_rails" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"rail" "payout_rail" NOT NULL,
	"phone" varchar(16),
	"bank_code" varchar(16),
	"account_number" varchar(32),
	"account_name" varchar(160),
	"verified" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"rail_id" text NOT NULL,
	"beneficiary_name" varchar(160) NOT NULL,
	"beneficiary_account" varchar(40) NOT NULL,
	"amount_minor_kes" numeric(18, 2) DEFAULT '0' NOT NULL,
	"confirmation" "payout_confirmation" DEFAULT 'not_required' NOT NULL,
	"pin_used" boolean DEFAULT false NOT NULL,
	"batch_reference" varchar(64),
	"status" "txn_status" DEFAULT 'initialized' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"channel" "reminder_channel" DEFAULT 'email' NOT NULL,
	"body" text,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"drafted_by" "reminder_drafter" DEFAULT 'template' NOT NULL,
	"guardrail" jsonb,
	"status" "reminder_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"composite_score" integer NOT NULL,
	"decision" "risk_decision" NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jev_answer_id" varchar(80),
	"fallback" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "split_beneficiaries" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(254),
	"account_no" varchar(40) NOT NULL,
	"bank_code" varchar(16),
	"rail" "split_rail" DEFAULT 'mpesa' NOT NULL,
	"split_type" "split_type" DEFAULT 'PERCENTAGE' NOT NULL,
	"split_value" numeric(8, 4) DEFAULT '0' NOT NULL,
	"payaza_split_code" varchar(40),
	"payaza_split_id" varchar(40),
	"active" boolean DEFAULT true NOT NULL,
	"fallback_payout_rail_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"invoice_id" text,
	"kind" "txn_kind" NOT NULL,
	"direction" "txn_direction" NOT NULL,
	"merchant_reference" varchar(40) NOT NULL,
	"payaza_reference" varchar(64),
	"channel" "txn_channel" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" numeric(18, 2) DEFAULT '0' NOT NULL,
	"fee_minor" numeric(18, 2),
	"net_minor" numeric(18, 2),
	"fx_rate" numeric(12, 6),
	"status" "txn_status" DEFAULT 'initialized' NOT NULL,
	"payaza_status_raw" varchar(48),
	"payload" jsonb,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone" varchar(16),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_kind" varchar(48) NOT NULL,
	"transaction_reference" varchar(64),
	"signature_valid" boolean NOT NULL,
	"dedupe_key" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_splits" ADD CONSTRAINT "invoice_splits_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_splits" ADD CONSTRAINT "invoice_splits_beneficiary_id_split_beneficiaries_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."split_beneficiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_rails" ADD CONSTRAINT "payout_rails_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_rail_id_payout_rails_id_fk" FOREIGN KEY ("rail_id") REFERENCES "public"."payout_rails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_beneficiaries" ADD CONSTRAINT "split_beneficiaries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_beneficiaries" ADD CONSTRAINT "split_beneficiaries_fallback_payout_rail_id_payout_rails_id_fk" FOREIGN KEY ("fallback_payout_rail_id") REFERENCES "public"."payout_rails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_extractions_business_idx" ON "ai_extractions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "buyers_business_idx" ON "buyers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_splits_invoice_idx" ON "invoice_splits" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_token_idx" ON "invoices" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_business_number_idx" ON "invoices" USING btree ("business_id","number");--> statement-breakpoint
CREATE INDEX "invoices_business_status_idx" ON "invoices" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "payout_rails_business_idx" ON "payout_rails" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "reminders_invoice_idx" ON "reminders" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "risk_assessments_invoice_idx" ON "risk_assessments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "split_beneficiaries_business_idx" ON "split_beneficiaries" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_merchant_reference_idx" ON "transactions" USING btree ("merchant_reference");--> statement-breakpoint
CREATE INDEX "transactions_business_created_idx" ON "transactions" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_invoice_idx" ON "transactions" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_dedupe_idx" ON "webhook_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "webhook_events_reference_idx" ON "webhook_events" USING btree ("transaction_reference");