ALTER TABLE "events" ADD COLUMN "event_date" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_location" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_note" text;
