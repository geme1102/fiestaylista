-- R1: gifts_event_id_idx is redundant with gifts_event_id_deleted_at_idx (superset)
DROP INDEX IF EXISTS gifts_event_id_idx;--> statement-breakpoint

-- R1: event_views_event_id_idx is redundant with event_views_event_id_viewed_at_idx (superset)
DROP INDEX IF EXISTS event_views_event_id_idx;
