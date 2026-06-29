CREATE TABLE "installation" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"install_id" text NOT NULL,
	"license_data" text,
	"license_signature" text,
	"last_validated_at" text,
	"activated_at" text,
	"created_at" text DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
);
