-- Indexes for ARCO and consent record queries by userId
CREATE INDEX IF NOT EXISTS "arco_requests_user_id_idx" ON "arco_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_records_user_id_idx" ON "consent_records" USING btree ("user_id");
