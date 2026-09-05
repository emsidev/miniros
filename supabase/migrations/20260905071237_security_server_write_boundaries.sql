-- Relational writes use authenticated Next services and Drizzle transactions.
-- Legacy setup grants allowed a row owned by business A to reference a UUID in
-- business B, bypassing the same-business checks in those services.
revoke insert, update, delete on table
  public.businesses,
  public.employees,
  public.product_categories,
  public.products,
  public.inventory_items,
  public.product_recipe_items,
  public.product_production_outputs,
  public.selling_locations,
  public.shifts,
  public.shift_assignments,
  public.shift_costs,
  public.inventory_locations,
  public.promo_rules
from public, anon, authenticated;

-- Keep RLS-filtered reads and own-profile maintenance. Server-role DML grants
-- are unchanged. Every proof upload must pass the server's size, signature,
-- payment, assignment and prepared-device checks before reaching Storage.
drop policy if exists "payment proofs insert authorized" on storage.objects;
drop policy if exists "payment proofs update authorized" on storage.objects;
drop policy if exists "payment proofs select authorized" on storage.objects;

-- The linked-proofs SELECT policy added by the discount-photo migration also
-- covers legacy paths when their exact object path is linked in public.files.
-- Do not revoke storage.objects privileges globally: other buckets can have
-- independent policies outside MINIROS.
