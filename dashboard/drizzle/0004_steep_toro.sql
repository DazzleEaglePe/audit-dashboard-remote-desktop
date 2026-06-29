CREATE TABLE "enrollment_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"name" text NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" text,
	"revoked" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
	CONSTRAINT "enrollment_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "device_id" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "enrolled_via" integer;--> statement-breakpoint
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_tokens_tenant_id_idx" ON "enrollment_tokens" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_enrolled_via_enrollment_tokens_id_fk" FOREIGN KEY ("enrolled_via") REFERENCES "public"."enrollment_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_tenant_id_device_id_idx" ON "api_keys" USING btree ("tenant_id","device_id");