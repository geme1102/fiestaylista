-- Make events.slug unique constraint soft-delete aware
-- so a new event can reuse a slug from a deleted event.
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_slug_unique";
DROP INDEX IF EXISTS "events_slug_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_unique" ON "events"("slug") WHERE "deleted_at" IS NULL;
