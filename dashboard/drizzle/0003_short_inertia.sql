ALTER TABLE "servers" ADD COLUMN "name" text;--> statement-breakpoint
CREATE INDEX "alerts_tenant_id_is_read_idx" ON "alerts" USING btree ("tenant_id","is_read");--> statement-breakpoint
CREATE INDEX "server_metrics_server_id_timestamp_idx" ON "server_metrics" USING btree ("server_id","timestamp");--> statement-breakpoint
CREATE INDEX "server_metrics_tenant_id_timestamp_idx" ON "server_metrics" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "session_logs_tenant_id_timestamp_idx" ON "session_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "sessions_tenant_id_server_id_idx" ON "sessions" USING btree ("tenant_id","server_id");