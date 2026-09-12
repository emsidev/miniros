ALTER TABLE "products" ADD COLUMN "stock_inventory_item_id" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "opening_cash_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_business_id_key" ON "inventory_items" USING btree ("business_id","id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_tenant_fk" FOREIGN KEY ("business_id","stock_inventory_item_id") REFERENCES "public"."inventory_items"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opening_cash_nonnegative" CHECK ("shifts"."opening_cash_cents" >= 0);
