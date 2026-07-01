CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."closeout_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('fixed_amount', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('payment_proof', 'product_image', 'profile_image', 'other');--> statement-breakpoint
CREATE TYPE "public"."inventory_adjustment_status" AS ENUM('pending', 'approved', 'rejected', 'applied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inventory_count_type" AS ENUM('opening', 'closing');--> statement-breakpoint
CREATE TYPE "public"."inventory_event_type" AS ENUM('opening_count', 'closeout_count', 'sale_deduction', 'production_input', 'production_output', 'adjustment', 'receiving', 'transfer_in', 'transfer_out');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_type" AS ENUM('raw_good', 'consumable', 'non_consumable', 'finished_good', 'packaging');--> statement-breakpoint
CREATE TYPE "public"."inventory_location_type" AS ENUM('central', 'selling_location', 'shift');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('booth', 'bazaar', 'kiosk', 'pop_up', 'mall_booth', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'operator', 'employee');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pending', 'active', 'rejected', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."offline_action_status" AS ENUM('pending', 'processing', 'synced', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."offline_action_type" AS ENUM('START_SHIFT', 'CREATE_SALE', 'UPLOAD_PAYMENT_PROOF', 'CREATE_PRODUCTION_LOG', 'CREATE_CASH_DEDUCTION', 'CREATE_INVENTORY_ADJUSTMENT', 'SUBMIT_CLOSEOUT', 'RECEIVE_STOCK', 'TRANSFER_STOCK');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."profit_result" AS ENUM('profit', 'break_even', 'loss');--> statement-breakpoint
CREATE TYPE "public"."promo_status" AS ENUM('active', 'inactive', 'expired');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sale_change_request_type" AS ENUM('void', 'refund', 'correction');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('draft', 'completed', 'voided', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."shift_assignment_role" AS ENUM('operator', 'employee', 'manager');--> statement-breakpoint
CREATE TYPE "public"."shift_assignment_status" AS ENUM('assigned', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."shift_cost_type" AS ENUM('rent', 'transport', 'other');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('scheduled', 'active', 'closing', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_transfer_status" AS ENUM('draft', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"auth_user_id" uuid,
	"role" "member_role" NOT NULL,
	"status" "member_status" DEFAULT 'pending' NOT NULL,
	"invited_email" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"status" "business_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"member_id" uuid,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"default_shift_rate_cents" bigint DEFAULT 0 NOT NULL,
	"can_use_pos" boolean DEFAULT false NOT NULL,
	"can_log_production" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"sku" text,
	"description" text,
	"price_cents" bigint DEFAULT 0 NOT NULL,
	"cost_cents" bigint DEFAULT 0 NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"is_sellable" boolean DEFAULT true NOT NULL,
	"requires_recipe_deduction" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"inventory_location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity_on_hand" numeric(14, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_event_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity_delta" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_cost_cents" bigint DEFAULT 0 NOT NULL,
	"balance_after" numeric(14, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid,
	"inventory_location_id" uuid,
	"event_type" "inventory_event_type" NOT NULL,
	"source_type" text,
	"source_id" uuid,
	"notes" text,
	"created_by" uuid,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"item_type" "inventory_item_type" NOT NULL,
	"unit" text NOT NULL,
	"default_unit_cost_cents" bigint DEFAULT 0 NOT NULL,
	"track_stock" boolean DEFAULT true NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"selling_location_id" uuid,
	"shift_id" uuid,
	"name" text NOT NULL,
	"location_type" "inventory_location_type" NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_recipe_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_inventory_counts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"count_type" "inventory_count_type" NOT NULL,
	"counted_quantity" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL,
	"counted_by" uuid,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selling_locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location_type" "location_type" DEFAULT 'booth' NOT NULL,
	"address" text,
	"notes" text,
	"default_rental_cost_cents" bigint DEFAULT 0 NOT NULL,
	"default_transport_cost_cents" bigint DEFAULT 0 NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"role_on_shift" "shift_assignment_role" DEFAULT 'employee' NOT NULL,
	"salary_rate_cents" bigint DEFAULT 0 NOT NULL,
	"status" "shift_assignment_status" DEFAULT 'assigned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_costs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"cost_type" "shift_cost_type" NOT NULL,
	"label" text NOT NULL,
	"amount_cents" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"selling_location_id" uuid NOT NULL,
	"title" text,
	"shift_date" date NOT NULL,
	"scheduled_start_at" timestamp with time zone,
	"scheduled_end_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"status" "shift_status" DEFAULT 'scheduled' NOT NULL,
	"started_by" uuid,
	"closed_by" uuid,
	"notes" text,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"bucket_id" text NOT NULL,
	"object_path" text NOT NULL,
	"file_type" "file_type" NOT NULL,
	"mime_type" text,
	"size_bytes" bigint,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reference_number" text,
	"proof_file_id" uuid,
	"status" "payment_status" DEFAULT 'completed' NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"line_total_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"selling_location_id" uuid NOT NULL,
	"sale_number" text NOT NULL,
	"status" "sale_status" DEFAULT 'completed' NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"amount_paid_cents" bigint DEFAULT 0 NOT NULL,
	"change_cents" bigint DEFAULT 0 NOT NULL,
	"sold_by" uuid,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid,
	"product_id" uuid,
	"inventory_location_id" uuid,
	"quantity_produced" numeric(14, 3) NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"notes" text,
	"logged_by" uuid,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_deductions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reason" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid,
	"inventory_location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity_delta" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"status" "inventory_adjustment_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_change_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"request_type" "sale_change_request_type" NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"requested_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_reconciliations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"closeout_id" uuid NOT NULL,
	"expected_cash_cents" bigint DEFAULT 0 NOT NULL,
	"actual_cash_cents" bigint DEFAULT 0 NOT NULL,
	"cash_difference_cents" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_closeouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"status" "closeout_status" DEFAULT 'submitted' NOT NULL,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"notes" text,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_profit_summaries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"selling_location_id" uuid NOT NULL,
	"gross_sales_cents" bigint DEFAULT 0 NOT NULL,
	"total_discounts_cents" bigint DEFAULT 0 NOT NULL,
	"net_sales_cents" bigint DEFAULT 0 NOT NULL,
	"cash_sales_cents" bigint DEFAULT 0 NOT NULL,
	"non_cash_sales_cents" bigint DEFAULT 0 NOT NULL,
	"salary_cost_cents" bigint DEFAULT 0 NOT NULL,
	"rental_cost_cents" bigint DEFAULT 0 NOT NULL,
	"transport_cost_cents" bigint DEFAULT 0 NOT NULL,
	"approved_deductions_cents" bigint DEFAULT 0 NOT NULL,
	"other_costs_cents" bigint DEFAULT 0 NOT NULL,
	"total_costs_cents" bigint DEFAULT 0 NOT NULL,
	"profit_cents" bigint DEFAULT 0 NOT NULL,
	"result" "profit_result" NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_sync_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"shift_id" uuid,
	"client_action_id" uuid NOT NULL,
	"action_type" "offline_action_type" NOT NULL,
	"status" "offline_action_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_employee_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"shift_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_receiving_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"stock_receiving_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_cost_cents" numeric(14, 0) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_receivings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"inventory_location_id" uuid NOT NULL,
	"reference_number" text,
	"notes" text,
	"received_by" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"stock_transfer_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"from_inventory_location_id" uuid NOT NULL,
	"to_inventory_location_id" uuid NOT NULL,
	"status" "stock_transfer_status" DEFAULT 'completed' NOT NULL,
	"notes" text,
	"transferred_by" uuid,
	"transferred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_generated_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" numeric(14, 2) NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"status" "promo_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_member_id_business_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_event_lines" ADD CONSTRAINT "inventory_event_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_event_lines" ADD CONSTRAINT "inventory_event_lines_event_id_inventory_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."inventory_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_event_lines" ADD CONSTRAINT "inventory_event_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_selling_location_id_selling_locations_id_fk" FOREIGN KEY ("selling_location_id") REFERENCES "public"."selling_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipe_items" ADD CONSTRAINT "product_recipe_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipe_items" ADD CONSTRAINT "product_recipe_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipe_items" ADD CONSTRAINT "product_recipe_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_inventory_counts" ADD CONSTRAINT "shift_inventory_counts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_inventory_counts" ADD CONSTRAINT "shift_inventory_counts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_inventory_counts" ADD CONSTRAINT "shift_inventory_counts_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_inventory_counts" ADD CONSTRAINT "shift_inventory_counts_counted_by_employees_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selling_locations" ADD CONSTRAINT "selling_locations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_costs" ADD CONSTRAINT "shift_costs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_costs" ADD CONSTRAINT "shift_costs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_costs" ADD CONSTRAINT "shift_costs_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_selling_location_id_selling_locations_id_fk" FOREIGN KEY ("selling_location_id") REFERENCES "public"."selling_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_started_by_employees_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_employees_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_proof_file_id_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_selling_location_id_selling_locations_id_fk" FOREIGN KEY ("selling_location_id") REFERENCES "public"."selling_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_employees_id_fk" FOREIGN KEY ("sold_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_logged_by_employees_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_deductions" ADD CONSTRAINT "cash_deductions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_deductions" ADD CONSTRAINT "cash_deductions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_deductions" ADD CONSTRAINT "cash_deductions_requested_by_employees_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_deductions" ADD CONSTRAINT "cash_deductions_reviewed_by_employees_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_requested_by_employees_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_reviewed_by_employees_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_change_requests" ADD CONSTRAINT "sale_change_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_change_requests" ADD CONSTRAINT "sale_change_requests_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_change_requests" ADD CONSTRAINT "sale_change_requests_requested_by_employees_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_change_requests" ADD CONSTRAINT "sale_change_requests_reviewed_by_employees_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_closeout_id_shift_closeouts_id_fk" FOREIGN KEY ("closeout_id") REFERENCES "public"."shift_closeouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_closeouts" ADD CONSTRAINT "shift_closeouts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_closeouts" ADD CONSTRAINT "shift_closeouts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_closeouts" ADD CONSTRAINT "shift_closeouts_submitted_by_employees_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_closeouts" ADD CONSTRAINT "shift_closeouts_approved_by_employees_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_profit_summaries" ADD CONSTRAINT "shift_profit_summaries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_profit_summaries" ADD CONSTRAINT "shift_profit_summaries_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_profit_summaries" ADD CONSTRAINT "shift_profit_summaries_selling_location_id_selling_locations_id_fk" FOREIGN KEY ("selling_location_id") REFERENCES "public"."selling_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_actions" ADD CONSTRAINT "offline_sync_actions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_actions" ADD CONSTRAINT "offline_sync_actions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_actions" ADD CONSTRAINT "offline_sync_actions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_employee_id_employees_id_fk" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receiving_lines" ADD CONSTRAINT "stock_receiving_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receiving_lines" ADD CONSTRAINT "stock_receiving_lines_stock_receiving_id_stock_receivings_id_fk" FOREIGN KEY ("stock_receiving_id") REFERENCES "public"."stock_receivings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receiving_lines" ADD CONSTRAINT "stock_receiving_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receivings" ADD CONSTRAINT "stock_receivings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receivings" ADD CONSTRAINT "stock_receivings_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receivings" ADD CONSTRAINT "stock_receivings_received_by_employees_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stock_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("stock_transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("from_inventory_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_inventory_location_id_inventory_locations_id_fk" FOREIGN KEY ("to_inventory_location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_transferred_by_employees_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_rules" ADD CONSTRAINT "promo_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_members_business_id_idx" ON "business_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_members_auth_user_id_idx" ON "business_members" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_members_business_auth_user_unique" ON "business_members" USING btree ("business_id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_unique" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "employees_business_id_idx" ON "employees" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "employees_member_id_idx" ON "employees" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "product_categories_business_id_idx" ON "product_categories" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_business_name_unique" ON "product_categories" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "products_business_id_idx" ON "products" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_business_sku_unique" ON "products" USING btree ("business_id","sku");--> statement-breakpoint
CREATE INDEX "inventory_balances_location_item_idx" ON "inventory_balances" USING btree ("inventory_location_id","inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_balances_business_location_item_unique" ON "inventory_balances" USING btree ("business_id","inventory_location_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "inventory_event_lines_event_id_idx" ON "inventory_event_lines" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "inventory_events_shift_id_idx" ON "inventory_events" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_events_business_client_generated_id_unique" ON "inventory_events" USING btree ("business_id","client_generated_id");--> statement-breakpoint
CREATE INDEX "inventory_items_business_id_idx" ON "inventory_items" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_business_sku_unique" ON "inventory_items" USING btree ("business_id","sku");--> statement-breakpoint
CREATE INDEX "inventory_locations_business_id_idx" ON "inventory_locations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_locations_shift_id_idx" ON "inventory_locations" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "product_recipe_items_product_id_idx" ON "product_recipe_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_recipe_items_product_item_unique" ON "product_recipe_items" USING btree ("product_id","inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_inventory_counts_shift_item_type_unique" ON "shift_inventory_counts" USING btree ("shift_id","inventory_item_id","count_type");--> statement-breakpoint
CREATE INDEX "selling_locations_business_id_idx" ON "selling_locations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "shift_assignments_shift_id_idx" ON "shift_assignments" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_assignments_shift_employee_unique" ON "shift_assignments" USING btree ("shift_id","employee_id");--> statement-breakpoint
CREATE INDEX "shift_costs_shift_id_idx" ON "shift_costs" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shifts_business_id_idx" ON "shifts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "shifts_selling_location_id_idx" ON "shifts" USING btree ("selling_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_business_client_generated_id_unique" ON "shifts" USING btree ("business_id","client_generated_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_bucket_object_unique" ON "files" USING btree ("bucket_id","object_path");--> statement-breakpoint
CREATE INDEX "payments_sale_id_idx" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_business_client_generated_id_unique" ON "payments" USING btree ("business_id","client_generated_id");--> statement-breakpoint
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_shift_id_idx" ON "sales" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_business_sale_number_unique" ON "sales" USING btree ("business_id","sale_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_business_client_generated_id_unique" ON "sales" USING btree ("business_id","client_generated_id");--> statement-breakpoint
CREATE INDEX "production_logs_shift_id_idx" ON "production_logs" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_logs_business_client_generated_id_unique" ON "production_logs" USING btree ("business_id","client_generated_id");--> statement-breakpoint
CREATE INDEX "cash_deductions_shift_id_idx" ON "cash_deductions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_shift_id_idx" ON "inventory_adjustments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "sale_change_requests_sale_id_idx" ON "sale_change_requests" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_closeouts_shift_id_unique" ON "shift_closeouts" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_closeouts_business_client_generated_id_unique" ON "shift_closeouts" USING btree ("business_id","client_generated_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_profit_summaries_shift_id_unique" ON "shift_profit_summaries" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_profit_summaries_location_id_idx" ON "shift_profit_summaries" USING btree ("selling_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_sync_actions_business_client_action_unique" ON "offline_sync_actions" USING btree ("business_id","client_action_id");--> statement-breakpoint
CREATE INDEX "offline_sync_actions_shift_id_idx" ON "offline_sync_actions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "audit_logs_business_id_created_at_idx" ON "audit_logs" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "stock_receiving_lines_receiving_id_idx" ON "stock_receiving_lines" USING btree ("stock_receiving_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_receivings_business_client_generated_id_unique" ON "stock_receivings" USING btree ("business_id","client_generated_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_lines_transfer_id_idx" ON "stock_transfer_lines" USING btree ("stock_transfer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfers_business_client_generated_id_unique" ON "stock_transfers" USING btree ("business_id","client_generated_id");