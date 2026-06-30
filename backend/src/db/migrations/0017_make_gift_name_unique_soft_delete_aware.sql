-- Make gift name + event_id unique constraint soft-delete aware
-- so deleted gifts don't block re-creating a gift with the same name.
DROP INDEX IF EXISTS "gifts_event_id_name_unique";
ALTER TABLE "gifts" DROP CONSTRAINT IF EXISTS "gifts_event_id_name_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "gifts_event_id_name_unique" ON "gifts"("event_id", "name") WHERE "deleted_at" IS NULL;
