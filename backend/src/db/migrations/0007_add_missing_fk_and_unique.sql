ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_event_id_name_unique" UNIQUE("event_id", "name");--> statement-breakpoint
ALTER TABLE "cash_contributions" ADD CONSTRAINT "cash_contributions_mp_payment_id_unique" UNIQUE("mp_payment_id");
