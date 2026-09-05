ALTER TABLE "sales" ADD COLUMN "discount_promo_name" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_promo_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_proof_request_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_proof_file_id" uuid;--> statement-breakpoint
ALTER TABLE "promo_rules" ADD COLUMN "requires_photo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_discount_proof_file_id_files_id_fk" FOREIGN KEY ("discount_proof_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;

-- Proof uploads use the authenticated server service. Only linked files are readable.
create policy "promo photos select authorized" on public.files
for select to authenticated using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1 from public.sales s
    where s.discount_proof_file_id = files.id and s.business_id = files.business_id
  )
);
-- The sales SELECT policy scopes this lookup to owners/admins and assigned POS staff.
-- This also supports the content-addressed paths used by payment proof retries.
create policy "linked proofs select authorized" on storage.objects
for select to authenticated using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1 from public.files f
    where f.bucket_id = objects.bucket_id and f.object_path = objects.name
  )
);

-- Set up the requested discounts as ordinary, editable promos for these businesses.
insert into public.promo_rules (id, business_id, name, discount_type, discount_value, requires_photo)
select gen_random_uuid(), b.id, p.name, 'fixed_amount', 10, true
from public.businesses b
cross join (values ('PWD Discount'), ('Senior Discount')) p(name)
where regexp_replace(lower(b.name), '[^a-z0-9]', '', 'g') in ('bettercup', 'minispastries')
  and not exists (select 1 from public.promo_rules r where r.business_id = b.id and lower(r.name) = lower(p.name));
