CREATE TABLE "telegram_link_codes" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" varchar(32) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"username" varchar(64),
	"first_name" varchar(128),
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_chat_idx" ON "telegram_links" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "telegram_links_email_idx" ON "telegram_links" USING btree ("user_email");