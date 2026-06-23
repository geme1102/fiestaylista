-- Consolidación de migraciones que antes se ejecutaban inline en src/index.ts.
-- Idempotente (IF NOT EXISTS): segura en DBs nuevas y existentes.

ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

CREATE TABLE IF NOT EXISTS "guests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "is_confirmed" boolean NOT NULL DEFAULT false,
  "companions" integer NOT NULL DEFAULT 0,
  "dietary_restrictions" text,
  "message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "guests_event_id_idx" ON "guests"("event_id");
CREATE INDEX IF NOT EXISTS "guests_event_id_confirmed_idx" ON "guests"("event_id", "is_confirmed");

ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_phone" text;
ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_type" text;

ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "is_group_gift" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "gift_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "gift_id" uuid NOT NULL REFERENCES "gifts"("id") ON DELETE CASCADE,
  "claimed_by" text NOT NULL,
  "message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "gift_claims_gift_id_idx" ON "gift_claims"("gift_id");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "author_name" text NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "messages_event_id_idx" ON "messages"("event_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at");

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "photos_is_featured_idx" ON "photos"("is_featured");
