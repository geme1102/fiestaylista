CREATE TABLE "pro_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mp_payment_id" text NOT NULL,
	"amount" integer NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pro_payments_mp_payment_id_unique" UNIQUE("mp_payment_id")
);
--> statement-breakpoint
DROP INDEX "gifts_event_id_idx";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_date" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_location" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_note" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "pro_payments" ADD CONSTRAINT "pro_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pro_payments_user_id_idx" ON "pro_payments" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arco_requests_user_id_idx" ON "arco_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "boost_payments_event_id_idx" ON "boost_payments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "cash_contributions_cash_fund_id_idx" ON "cash_contributions" USING btree ("cash_fund_id");--> statement-breakpoint
CREATE INDEX "cash_contributions_status_created_at_idx" ON "cash_contributions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "consent_records_user_id_idx" ON "consent_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_tracking_user_id_type_unique_idx" ON "email_tracking" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "email_tracking_sent_at_idx" ON "email_tracking" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_tracking_user_id_type_sent_at_idx" ON "email_tracking" USING btree ("user_id","type","sent_at");--> statement-breakpoint
CREATE INDEX "event_views_event_id_viewed_at_idx" ON "event_views" USING btree ("event_id","viewed_at");--> statement-breakpoint
CREATE INDEX "events_user_id_deleted_at_idx" ON "events" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "events_deleted_at_idx" ON "events" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "events_user_id_is_active_deleted_at_idx" ON "events" USING btree ("user_id","is_active","deleted_at");--> statement-breakpoint
CREATE INDEX "failed_webhooks_status_idx" ON "failed_webhooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "failed_webhooks_next_retry_at_idx" ON "failed_webhooks" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "gifts_event_id_deleted_at_idx" ON "gifts" USING btree ("event_id","deleted_at");--> statement-breakpoint
CREATE INDEX "gifts_event_id_unclaimed_idx" ON "gifts" USING btree ("event_id") WHERE "gifts"."is_claimed" = false;--> statement-breakpoint
CREATE INDEX "photos_event_id_idx" ON "photos" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "platform_fees_contribution_id_idx" ON "platform_fees" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE INDEX "users_verification_token_idx" ON "users" USING btree ("verification_token");--> statement-breakpoint
CREATE INDEX "users_reset_token_idx" ON "users" USING btree ("reset_token");--> statement-breakpoint
ALTER TABLE "cash_contributions" ADD CONSTRAINT "cash_contributions_mp_payment_id_unique" UNIQUE("mp_payment_id");--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_event_id_name_unique" UNIQUE("event_id","name");