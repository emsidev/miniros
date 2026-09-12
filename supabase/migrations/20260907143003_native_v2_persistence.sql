-- Additive native v2 tables. Candidate indexes precede composite foreign keys.
-- The effects FK is deferred to permit effects-before-receipt atomic fault testing.
-- No raw Data API or Realtime access; authorized server transactions own ingestion.
CREATE TABLE "v2_authorities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot_hash" text NOT NULL,
	"cashier_installation_id" uuid NOT NULL,
	"authority_epoch" bigint NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'unopened' NOT NULL,
	"projection" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_authorities_state_check" CHECK ("v2_authorities"."state" IN ('unopened','open','closed')),
	CONSTRAINT "v2_authorities_projection_object" CHECK (jsonb_typeof("v2_authorities"."projection") = 'object'),
	CONSTRAINT "v2_authorities_snapshot_hash_sha256" CHECK ("v2_authorities"."snapshot_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "v2_authorities_authority_epoch_safe" CHECK ("v2_authorities"."authority_epoch" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_authorities_last_sequence_safe" CHECK ("v2_authorities"."last_sequence" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "v2_authorities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_close_manifests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"authority_epoch" bigint NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"last_financial_sequence" bigint NOT NULL,
	"journal_digest" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "v2_close_manifests_manifest_object" CHECK (jsonb_typeof("v2_close_manifests"."manifest") = 'object'),
	CONSTRAINT "v2_close_manifests_authority_epoch_safe" CHECK ("v2_close_manifests"."authority_epoch" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_close_manifests_sequence_safe" CHECK ("v2_close_manifests"."sequence" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_close_manifests_last_financial_sequence_safe" CHECK ("v2_close_manifests"."last_financial_sequence" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "v2_close_manifests_journal_digest_sha256" CHECK ("v2_close_manifests"."journal_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "v2_close_manifests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_count_seals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"authority_epoch" bigint NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"kind" text NOT NULL,
	"counts" jsonb NOT NULL,
	"cash_minor" bigint,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "v2_count_seals_kind_check" CHECK ("v2_count_seals"."kind" IN ('opening','closing') AND ("v2_count_seals"."kind" <> 'opening' OR "v2_count_seals"."cash_minor" IS NOT NULL)),
	CONSTRAINT "v2_count_seals_counts_array" CHECK (jsonb_typeof("v2_count_seals"."counts") = 'array' AND jsonb_array_length("v2_count_seals"."counts") <= 500),
	CONSTRAINT "v2_count_seals_authority_epoch_safe" CHECK ("v2_count_seals"."authority_epoch" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_count_seals_sequence_safe" CHECK ("v2_count_seals"."sequence" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_count_seals_cash_minor_safe" CHECK ("v2_count_seals"."cash_minor" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "v2_count_seals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_device_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"authority_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"authority_epoch" bigint NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot_hash" text NOT NULL,
	"role" text NOT NULL,
	"allowed_kinds" jsonb NOT NULL,
	"grant_spki" text NOT NULL,
	"issued_by" uuid NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revocation_reason" text,
	CONSTRAINT "v2_device_grants_role_check" CHECK ("v2_device_grants"."role" IN ('cashier','prep')),
	CONSTRAINT "v2_device_grants_validity_check" CHECK ("v2_device_grants"."expires_at" > "v2_device_grants"."issued_at" AND "v2_device_grants"."expires_at" <= "v2_device_grants"."issued_at" + interval '24 hours'),
	CONSTRAINT "v2_device_grants_capabilities_array" CHECK (jsonb_typeof("v2_device_grants"."allowed_kinds") = 'array' AND jsonb_array_length("v2_device_grants"."allowed_kinds") <= 12),
	CONSTRAINT "v2_device_grants_authority_epoch_safe" CHECK ("v2_device_grants"."authority_epoch" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_device_grants_snapshot_hash_sha256" CHECK ("v2_device_grants"."snapshot_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_effects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"stock_delta_atoms" jsonb NOT NULL,
	"cash_delta_minor" bigint NOT NULL,
	"gross_sales_delta_minor" bigint NOT NULL,
	"discounts_delta_minor" bigint NOT NULL,
	"refunds_delta_minor" bigint NOT NULL,
	"manual_digital_delta_minor" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "v2_effects_stockDeltaAtoms_object" CHECK (jsonb_typeof("v2_effects"."stock_delta_atoms") = 'object'),
	CONSTRAINT "v2_effects_sequence_safe" CHECK ("v2_effects"."sequence" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_effects_cash_delta_minor_safe" CHECK ("v2_effects"."cash_delta_minor" BETWEEN -9007199254740991 AND 9007199254740991),
	CONSTRAINT "v2_effects_gross_sales_delta_minor_safe" CHECK ("v2_effects"."gross_sales_delta_minor" BETWEEN -9007199254740991 AND 9007199254740991),
	CONSTRAINT "v2_effects_discounts_delta_minor_safe" CHECK ("v2_effects"."discounts_delta_minor" BETWEEN -9007199254740991 AND 9007199254740991),
	CONSTRAINT "v2_effects_refunds_delta_minor_safe" CHECK ("v2_effects"."refunds_delta_minor" BETWEEN -9007199254740991 AND 9007199254740991),
	CONSTRAINT "v2_effects_manual_digital_delta_minor_safe" CHECK ("v2_effects"."manual_digital_delta_minor" BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "v2_effects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_ingest_incidents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"operation_id" uuid,
	"command_id" uuid,
	"authority_epoch" bigint,
	"sequence" bigint,
	"canonical_digest" text,
	"category" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_reason" text,
	CONSTRAINT "v2_ingest_incidents_evidence_object" CHECK (jsonb_typeof("v2_ingest_incidents"."evidence") = 'object'),
	CONSTRAINT "v2_ingest_incidents_evidence_bound" CHECK (octet_length("v2_ingest_incidents"."evidence"::text) <= 1048576),
	CONSTRAINT "v2_ingest_incidents_authority_epoch_safe" CHECK ("v2_ingest_incidents"."authority_epoch" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_ingest_incidents_sequence_safe" CHECK ("v2_ingest_incidents"."sequence" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_ingest_incidents_canonical_digest_sha256" CHECK ("v2_ingest_incidents"."canonical_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "v2_ingest_incidents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"authority_id" uuid NOT NULL,
	"authority_epoch" bigint NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot_hash" text NOT NULL,
	"installation_id" uuid NOT NULL,
	"grant_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"kind" text NOT NULL,
	"canonical_digest" text NOT NULL,
	"envelope" jsonb NOT NULL,
	"receipt" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "v2_operations_kind_check" CHECK ("v2_operations"."kind" IN ('OPEN_SHIFT','SALE','REFUND','COMPLIMENTARY','REMAKE','RESTOCK','WASTE','ADJUST_STOCK','RETURN_UNPREPARED','PREP_TRANSITION','CASH_ADJUSTMENT','CLOSE_SHIFT')),
	CONSTRAINT "v2_operations_envelope_object" CHECK (jsonb_typeof("v2_operations"."envelope") = 'object'),
	CONSTRAINT "v2_operations_receipt_object" CHECK (jsonb_typeof("v2_operations"."receipt") = 'object'),
	CONSTRAINT "v2_operations_authority_epoch_safe" CHECK ("v2_operations"."authority_epoch" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_operations_snapshot_hash_sha256" CHECK ("v2_operations"."snapshot_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "v2_operations_sequence_safe" CHECK ("v2_operations"."sequence" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_operations_canonical_digest_sha256" CHECK ("v2_operations"."canonical_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "v2_operations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_prep_commands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"authority_id" uuid NOT NULL,
	"authority_epoch" bigint NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot_hash" text NOT NULL,
	"installation_id" uuid NOT NULL,
	"grant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"action" text NOT NULL,
	"canonical_digest" text NOT NULL,
	"command" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"applied_operation_id" uuid,
	CONSTRAINT "v2_prep_commands_command_object" CHECK (jsonb_typeof("v2_prep_commands"."command") = 'object'),
	CONSTRAINT "v2_prep_commands_action_check" CHECK ("v2_prep_commands"."action" IN ('making','done','unprepared-return')),
	CONSTRAINT "v2_prep_commands_authority_epoch_safe" CHECK ("v2_prep_commands"."authority_epoch" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_prep_commands_snapshot_hash_sha256" CHECK ("v2_prep_commands"."snapshot_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "v2_prep_commands_canonical_digest_sha256" CHECK ("v2_prep_commands"."canonical_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "v2_prep_commands" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_recovery_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"package_digest" text NOT NULL,
	"imported_by" uuid NOT NULL,
	"authorized_by" uuid NOT NULL,
	"authorization_reason" text NOT NULL,
	"source_authority_epoch" bigint NOT NULL,
	"manifest_id" uuid,
	"result" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "v2_recovery_imports_result_object" CHECK (jsonb_typeof("v2_recovery_imports"."result") = 'object'),
	CONSTRAINT "v2_recovery_imports_package_digest_sha256" CHECK ("v2_recovery_imports"."package_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "v2_recovery_imports_source_authority_epoch_safe" CHECK ("v2_recovery_imports"."source_authority_epoch" BETWEEN 1 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "v2_recovery_imports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "v2_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 2 NOT NULL,
	"version" bigint NOT NULL,
	"catalog_version" text NOT NULL,
	"recipe_version" text NOT NULL,
	"costing_version" text NOT NULL,
	"checklist_id" uuid NOT NULL,
	"checklist_version" bigint NOT NULL,
	"hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "v2_snapshots_schema_version" CHECK ("v2_snapshots"."schema_version" = 2),
	CONSTRAINT "v2_snapshots_snapshot_object" CHECK (jsonb_typeof("v2_snapshots"."snapshot") = 'object'),
	CONSTRAINT "v2_snapshots_version_safe" CHECK ("v2_snapshots"."version" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_snapshots_checklist_version_safe" CHECK ("v2_snapshots"."checklist_version" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "v2_snapshots_hash_sha256" CHECK ("v2_snapshots"."hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "v2_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_authorities_business_id_key" ON "v2_authorities" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_authorities_one_per_shift" ON "v2_authorities" USING btree ("business_id","shift_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_authorities_full_scope_key" ON "v2_authorities" USING btree ("business_id","shift_id","id","authority_epoch","snapshot_id","snapshot_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_close_manifests_business_id_key" ON "v2_close_manifests" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_close_manifests_operation_key" ON "v2_close_manifests" USING btree ("business_id","operation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_close_manifests_one_close_key" ON "v2_close_manifests" USING btree ("business_id","shift_id","authority_epoch");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_count_seals_business_id_key" ON "v2_count_seals" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_count_seals_operation_key" ON "v2_count_seals" USING btree ("business_id","operation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_count_seals_seal_key" ON "v2_count_seals" USING btree ("business_id","shift_id","authority_epoch","kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_device_grants_business_id_key" ON "v2_device_grants" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_device_grants_full_scope_key" ON "v2_device_grants" USING btree ("business_id","shift_id","id","authority_id","authority_epoch","snapshot_id","snapshot_hash","installation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_device_grants_active_installation_key" ON "v2_device_grants" USING btree ("business_id","shift_id","authority_epoch","installation_id","role") WHERE "v2_device_grants"."revoked_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_effects_business_id_key" ON "v2_effects" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_effects_operation_key" ON "v2_effects" USING btree ("business_id","operation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_ingest_incidents_business_id_key" ON "v2_ingest_incidents" USING btree ("business_id","id");
--> statement-breakpoint
CREATE INDEX "v2_ingest_incidents_shift_time_idx" ON "v2_ingest_incidents" USING btree ("business_id","shift_id","received_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_operations_business_id_key" ON "v2_operations" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_operations_sequence_key" ON "v2_operations" USING btree ("business_id","shift_id","authority_epoch","sequence");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_operations_scope_key" ON "v2_operations" USING btree ("business_id","shift_id","authority_epoch","snapshot_id","id","sequence");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_operations_effect_scope_key" ON "v2_operations" USING btree ("business_id","shift_id","id","sequence");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_operations_command_scope_key" ON "v2_operations" USING btree ("business_id","shift_id","authority_epoch","snapshot_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_prep_commands_business_id_key" ON "v2_prep_commands" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_prep_commands_applied_operation_key" ON "v2_prep_commands" USING btree ("business_id","applied_operation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_recovery_imports_business_id_key" ON "v2_recovery_imports" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_recovery_imports_package_key" ON "v2_recovery_imports" USING btree ("business_id","package_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_snapshots_business_id_key" ON "v2_snapshots" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_snapshots_version_key" ON "v2_snapshots" USING btree ("business_id","shift_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "v2_snapshots_scope_hash_key" ON "v2_snapshots" USING btree ("business_id","shift_id","id","hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "employees_v2_business_id_key" ON "employees" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "shift_assignments_v2_scope_key" ON "shift_assignments" USING btree ("business_id","shift_id","employee_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_v2_business_id_key" ON "shifts" USING btree ("business_id","id");
--> statement-breakpoint
ALTER TABLE "v2_authorities" ADD CONSTRAINT "v2_authorities_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_authorities" ADD CONSTRAINT "v2_authorities_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_authorities" ADD CONSTRAINT "v2_authorities_snapshot_fk" FOREIGN KEY ("business_id","shift_id","snapshot_id","snapshot_hash") REFERENCES "public"."v2_snapshots"("business_id","shift_id","id","hash") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_close_manifests" ADD CONSTRAINT "v2_close_manifests_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_close_manifests" ADD CONSTRAINT "v2_close_manifests_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_close_manifests" ADD CONSTRAINT "v2_close_manifests_operation_scope_fk" FOREIGN KEY ("business_id","shift_id","authority_epoch","snapshot_id","operation_id","sequence") REFERENCES "public"."v2_operations"("business_id","shift_id","authority_epoch","snapshot_id","id","sequence") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_count_seals" ADD CONSTRAINT "v2_count_seals_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_count_seals" ADD CONSTRAINT "v2_count_seals_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_count_seals" ADD CONSTRAINT "v2_count_seals_operation_scope_fk" FOREIGN KEY ("business_id","shift_id","authority_epoch","snapshot_id","operation_id","sequence") REFERENCES "public"."v2_operations"("business_id","shift_id","authority_epoch","snapshot_id","id","sequence") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ADD CONSTRAINT "v2_device_grants_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ADD CONSTRAINT "v2_device_grants_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ADD CONSTRAINT "v2_device_grants_creator_fk" FOREIGN KEY ("issued_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ADD CONSTRAINT "v2_device_grants_authority_scope_fk" FOREIGN KEY ("business_id","shift_id","authority_id","authority_epoch","snapshot_id","snapshot_hash") REFERENCES "public"."v2_authorities"("business_id","shift_id","id","authority_epoch","snapshot_id","snapshot_hash") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ADD CONSTRAINT "v2_device_grants_user_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ADD CONSTRAINT "v2_device_grants_employee_scope_fk" FOREIGN KEY ("business_id","employee_id") REFERENCES "public"."employees"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_device_grants" ADD CONSTRAINT "v2_device_grants_assignment_scope_fk" FOREIGN KEY ("business_id","shift_id","employee_id","assignment_id") REFERENCES "public"."shift_assignments"("business_id","shift_id","employee_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_effects" ADD CONSTRAINT "v2_effects_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_effects" ADD CONSTRAINT "v2_effects_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_effects" ADD CONSTRAINT "v2_effects_operation_fk" FOREIGN KEY ("business_id","shift_id","operation_id","sequence") REFERENCES "public"."v2_operations"("business_id","shift_id","id","sequence") ON DELETE restrict ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "v2_ingest_incidents" ADD CONSTRAINT "v2_ingest_incidents_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_ingest_incidents" ADD CONSTRAINT "v2_ingest_incidents_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_operations" ADD CONSTRAINT "v2_operations_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_operations" ADD CONSTRAINT "v2_operations_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_operations" ADD CONSTRAINT "v2_operations_authority_scope_fk" FOREIGN KEY ("business_id","shift_id","authority_id","authority_epoch","snapshot_id","snapshot_hash") REFERENCES "public"."v2_authorities"("business_id","shift_id","id","authority_epoch","snapshot_id","snapshot_hash") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_operations" ADD CONSTRAINT "v2_operations_grant_scope_fk" FOREIGN KEY ("business_id","shift_id","grant_id","authority_id","authority_epoch","snapshot_id","snapshot_hash","installation_id") REFERENCES "public"."v2_device_grants"("business_id","shift_id","id","authority_id","authority_epoch","snapshot_id","snapshot_hash","installation_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_prep_commands" ADD CONSTRAINT "v2_prep_commands_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_prep_commands" ADD CONSTRAINT "v2_prep_commands_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_prep_commands" ADD CONSTRAINT "v2_prep_commands_authority_scope_fk" FOREIGN KEY ("business_id","shift_id","authority_id","authority_epoch","snapshot_id","snapshot_hash") REFERENCES "public"."v2_authorities"("business_id","shift_id","id","authority_epoch","snapshot_id","snapshot_hash") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_prep_commands" ADD CONSTRAINT "v2_prep_commands_grant_scope_fk" FOREIGN KEY ("business_id","shift_id","grant_id","authority_id","authority_epoch","snapshot_id","snapshot_hash","installation_id") REFERENCES "public"."v2_device_grants"("business_id","shift_id","id","authority_id","authority_epoch","snapshot_id","snapshot_hash","installation_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_prep_commands" ADD CONSTRAINT "v2_prep_commands_applied_operation_fk" FOREIGN KEY ("business_id","shift_id","authority_epoch","snapshot_id","applied_operation_id") REFERENCES "public"."v2_operations"("business_id","shift_id","authority_epoch","snapshot_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_recovery_imports" ADD CONSTRAINT "v2_recovery_imports_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_recovery_imports" ADD CONSTRAINT "v2_recovery_imports_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_recovery_imports" ADD CONSTRAINT "v2_recovery_imports_importer_fk" FOREIGN KEY ("imported_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_recovery_imports" ADD CONSTRAINT "v2_recovery_imports_authorizer_fk" FOREIGN KEY ("authorized_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_recovery_imports" ADD CONSTRAINT "v2_recovery_imports_manifest_fk" FOREIGN KEY ("business_id","manifest_id") REFERENCES "public"."v2_close_manifests"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_snapshots" ADD CONSTRAINT "v2_snapshots_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_snapshots" ADD CONSTRAINT "v2_snapshots_shift_scope_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."shifts"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "v2_snapshots" ADD CONSTRAINT "v2_snapshots_creator_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL ON TABLE public.v2_authorities, public.v2_close_manifests, public.v2_count_seals, public.v2_device_grants, public.v2_effects, public.v2_ingest_incidents, public.v2_operations, public.v2_prep_commands, public.v2_recovery_imports, public.v2_snapshots FROM PUBLIC, anon, authenticated, service_role;
