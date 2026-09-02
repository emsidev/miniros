alter table public.products
  add column manual_cost_cents bigint not null default 0,
  add column labor_cost_cents bigint not null default 0,
  add column overhead_cost_cents bigint not null default 0,
  add column cost_override_cents bigint;

update public.products
set manual_cost_cents = cost_cents;

alter table public.products
  add constraint products_manual_cost_nonnegative check (manual_cost_cents >= 0),
  add constraint products_labor_cost_nonnegative check (labor_cost_cents >= 0),
  add constraint products_overhead_cost_nonnegative check (overhead_cost_cents >= 0),
  add constraint products_cost_override_nonnegative check (
    cost_override_cents is null or cost_override_cents >= 0
  );

with recipe_costs as (
  select
    recipe.product_id,
    round(sum(recipe.quantity * item.default_unit_cost_cents))::bigint
      as ingredient_cost_cents
  from public.product_recipe_items recipe
  join public.inventory_items item
    on item.id = recipe.inventory_item_id
   and item.business_id = recipe.business_id
   and item.deleted_at is null
  join public.businesses business
    on business.id = recipe.business_id
   and business.recipes_enabled
  join public.products product
    on product.id = recipe.product_id
   and product.business_id = recipe.business_id
   and product.deleted_at is null
   and product.status <> 'deleted'
  where recipe.deleted_at is null
  group by recipe.product_id
)
update public.products product
set
  cost_cents = recipe_costs.ingredient_cost_cents,
  cost_override_cents = null,
  updated_at = now()
from recipe_costs
where product.id = recipe_costs.product_id;
