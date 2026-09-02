-- Catalog safety -------------------------------------------------------------
-- Normalize existing catalog records before enforcing required categories,
-- mandatory SKUs, and the fixed inventory-unit list.

drop index if exists public.product_categories_business_name_unique;
create unique index product_categories_business_name_unique
  on public.product_categories using btree (business_id, lower(name));

with defaults(name, sort_order) as (
  values
    ('Add ons'::text, 0::bigint),
    ('Drinks'::text, 10::bigint),
    ('Desserts'::text, 20::bigint)
)
insert into public.product_categories (id, business_id, name, sort_order)
select gen_random_uuid(), b.id, d.name, d.sort_order
from public.businesses b
cross join defaults d
where b.deleted_at is null
on conflict (business_id, lower(name)) do update
set
  sort_order = excluded.sort_order,
  deleted_at = null,
  updated_at = now();

-- The existing product catalog is Matcha/Ube beverages. Use the approved
-- Drinks category for every legacy product that has not yet been categorized.
update public.products p
set category_id = c.id
from public.product_categories c
where c.business_id = p.business_id
  and lower(c.name) = 'drinks'
  and c.deleted_at is null
  and p.category_id is null;

update public.products
set sku = 'PRD-' ||
  coalesce(
    nullif(
      left(
        regexp_replace(upper(trim(name)), '[^A-Z0-9]+', '-', 'g'),
        43
      ),
      ''
    ),
    'ITEM'
  ) || '-' || upper(replace(id::text, '-', ''))
where sku is null or trim(sku) = '';

update public.inventory_items
set sku = 'INV-' ||
  coalesce(
    nullif(
      left(
        regexp_replace(upper(trim(name)), '[^A-Z0-9]+', '-', 'g'),
        43
      ),
      ''
    ),
    'ITEM'
  ) || '-' || upper(replace(id::text, '-', ''))
where sku is null or trim(sku) = '';

update public.inventory_items
set unit = case lower(trim(unit))
  when 'pc' then 'pcs'
  when 'piece' then 'pcs'
  when 'pieces' then 'pcs'
  when 'gram' then 'g'
  when 'grams' then 'g'
  when 'kilogram' then 'kg'
  when 'kilograms' then 'kg'
  when 'milliliter' then 'ml'
  when 'milliliters' then 'ml'
  when 'liter' then 'l'
  when 'liters' then 'l'
  else lower(trim(unit))
end;

alter table public.products
  alter column sku set not null,
  alter column category_id set not null;

alter table public.inventory_items
  alter column sku set not null;

alter table public.products
  drop constraint if exists products_category_id_product_categories_id_fk,
  add constraint products_category_id_product_categories_id_fk
    foreign key (category_id)
    references public.product_categories(id)
    on delete restrict;

alter table public.products
  add constraint products_sku_nonblank
    check (length(trim(sku)) > 0);

alter table public.inventory_items
  add constraint inventory_items_sku_nonblank
    check (length(trim(sku)) > 0),
  add constraint inventory_items_unit_allowed
    check (unit in ('pcs', 'pack', 'box', 'bottle', 'cup', 'g', 'kg', 'ml', 'l'));
