
CREATE TABLE "offline_pilots" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "offline_shift_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"acknowledged_sequence" integer DEFAULT 0 NOT NULL,
	"last_occurred_at" timestamp with time zone,
	"closeout_intent" jsonb,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "offline_sync_actions" ADD COLUMN "session_id" uuid;--> statement-breakpoint

ALTER TABLE "offline_sync_actions" ADD COLUMN "sequence" integer;--> statement-breakpoint

ALTER TABLE "offline_sync_actions" ADD COLUMN "payload_digest" text;--> statement-breakpoint

ALTER TABLE "offline_sync_actions" ADD COLUMN "result" jsonb;--> statement-breakpoint

ALTER TABLE "offline_sync_actions" ADD COLUMN "conflict_code" text;--> statement-breakpoint

ALTER TABLE "offline_pilots" ADD CONSTRAINT "offline_pilots_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "offline_pilots" ADD CONSTRAINT "offline_pilots_location_id_selling_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."selling_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "offline_shift_sessions" ADD CONSTRAINT "offline_shift_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "offline_shift_sessions" ADD CONSTRAINT "offline_shift_sessions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "offline_shift_sessions" ADD CONSTRAINT "offline_shift_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "offline_shift_one_owner" ON "offline_shift_sessions" USING btree ("business_id","shift_id") WHERE "offline_shift_sessions"."status" not in ('closed', 'released');--> statement-breakpoint

CREATE INDEX "offline_session_user_device" ON "offline_shift_sessions" USING btree ("user_id","device_id");--> statement-breakpoint

CREATE UNIQUE INDEX "offline_sync_session_sequence_unique" ON "offline_sync_actions" USING btree ("session_id","sequence");
-- Device identity and prepared catalogues are only returned through authenticated
-- services. The Data API must not expose snapshots or accept journal writes.
alter table public.offline_pilots enable row level security;
alter table public.offline_shift_sessions enable row level security;
revoke all on public.offline_pilots, public.offline_shift_sessions from public, anon, authenticated;
grant all on public.offline_pilots, public.offline_shift_sessions to service_role;
revoke insert, update, delete on public.offline_sync_actions from authenticated, anon;
alter table public.offline_shift_sessions add constraint offline_session_status_check
  check (status in ('prepared', 'active', 'closing', 'closed', 'recovery', 'released'));
alter table public.offline_shift_sessions add constraint offline_session_sequence_check check (acknowledged_sequence >= 0);
alter table public.offline_sync_actions add constraint offline_action_sequence_check check (sequence is null or sequence > 0);
alter table public.offline_sync_actions add constraint offline_action_session_fk foreign key (session_id) references public.offline_shift_sessions(id);
