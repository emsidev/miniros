-- MINIROS row-level security
-- Apply after the Drizzle-generated schema migration.
--
-- Dependency rule (keeps every policy non-recursive):
--   business_members -> no table lookup
--   employees        -> business_members
--   shift_assignments-> employees -> business_members
--   shifts/operations-> shift_assignments -> employees -> business_members
--
-- There are deliberately no privileged database helpers or workflow triggers
-- in this policy layer. Membership and business creation, membership
-- administration, and critical multi-table operational writes are server-only
-- workflows. The service role must remain server-side and each service must
-- independently repeat its authorization.

-- Every public business table is protected. There are 35 tables in total.
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.employees enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.product_recipe_items enable row level security;
alter table public.selling_locations enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.shift_costs enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_events enable row level security;
alter table public.inventory_event_lines enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.shift_inventory_counts enable row level security;
alter table public.production_logs enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.files enable row level security;
alter table public.sale_change_requests enable row level security;
alter table public.cash_deductions enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.shift_closeouts enable row level security;
alter table public.cash_reconciliations enable row level security;
alter table public.shift_profit_summaries enable row level security;
alter table public.offline_sync_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.stock_receivings enable row level security;
alter table public.stock_receiving_lines enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_lines enable row level security;
alter table public.promo_rules enable row level security;

-- Remove policy names from the original scaffold before installing the
-- hardened policies. This prevents permissive legacy policies surviving an
-- upgrade. Each new policy is also dropped immediately before recreation.
drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "members can read their businesses" on public.businesses;
drop policy if exists "members can read business members" on public.business_members;
drop policy if exists "owners and admins can manage members" on public.business_members;
drop policy if exists "members can read employees" on public.employees;
drop policy if exists "members can read products" on public.products;
drop policy if exists "members can read product categories" on public.product_categories;
drop policy if exists "members can read inventory items" on public.inventory_items;
drop policy if exists "members can read recipes" on public.product_recipe_items;
drop policy if exists "members can read locations" on public.selling_locations;
drop policy if exists "members can read shifts" on public.shifts;
drop policy if exists "members can read shift assignments" on public.shift_assignments;
drop policy if exists "members can read inventory balances" on public.inventory_balances;
drop policy if exists "members can read sales" on public.sales;
drop policy if exists "members can read payments" on public.payments;
drop policy if exists "members can read production logs" on public.production_logs;
drop policy if exists "members can read closeouts" on public.shift_closeouts;
drop policy if exists "members can read profit summaries" on public.shift_profit_summaries;
drop policy if exists "admins can manage products" on public.products;
drop policy if exists "admins can manage inventory items" on public.inventory_items;
drop policy if exists "admins can manage locations" on public.selling_locations;
drop policy if exists "admins can manage shifts" on public.shifts;

-- Profiles ------------------------------------------------------------------

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own"
on public.profiles for select to authenticated
using (profiles.id = (select auth.uid()));

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles for insert to authenticated
with check (profiles.id = (select auth.uid()));

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles for update to authenticated
using (profiles.id = (select auth.uid()))
with check (profiles.id = (select auth.uid()));

-- Workspace -----------------------------------------------------------------

drop policy if exists "businesses select active members" on public.businesses;
create policy "businesses select active members"
on public.businesses for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = businesses.id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "businesses update owner admin" on public.businesses;
create policy "businesses update owner admin"
on public.businesses for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = businesses.id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = businesses.id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

-- This is intentionally the only policy on business_members. A policy on this
-- table must not query business_members again. Owners/admins manage and list
-- other members through an independently authorized server-side service.
drop policy if exists "business members select own" on public.business_members;
create policy "business members select own"
on public.business_members for select to authenticated
using (
  business_members.auth_user_id = (select auth.uid())
  and business_members.deleted_at is null
);

-- Employees -----------------------------------------------------------------

drop policy if exists "employees select authorized" on public.employees;
create policy "employees select authorized"
on public.employees for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = employees.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    employees.status = 'active'
    and employees.deleted_at is null
    and exists (
      select 1 from public.business_members bm
      where bm.id = employees.member_id
        and bm.business_id = employees.business_id
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

drop policy if exists "employees insert owner admin" on public.employees;
create policy "employees insert owner admin"
on public.employees for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = employees.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "employees update owner admin" on public.employees;
create policy "employees update owner admin"
on public.employees for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = employees.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = employees.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

-- Catalog and recipes --------------------------------------------------------
-- Non-admin access requires an active employee record, an explicit POS or
-- production permission flag, and a current assignment in the same business.

drop policy if exists "product categories select authorized" on public.product_categories;
create policy "product categories select authorized"
on public.product_categories for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_categories.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    product_categories.deleted_at is null
    and exists (
      select 1
      from public.business_members bm
      join public.employees e
        on e.member_id = bm.id and e.business_id = bm.business_id
      join public.shift_assignments sa
        on sa.employee_id = e.id and sa.business_id = e.business_id
      where bm.business_id = product_categories.business_id
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
        and e.status = 'active'
        and e.deleted_at is null
        and (e.can_use_pos or e.can_log_production)
        and sa.status in ('assigned', 'confirmed')
    )
  )
);

drop policy if exists "product categories insert owner admin" on public.product_categories;
create policy "product categories insert owner admin"
on public.product_categories for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_categories.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "product categories update owner admin" on public.product_categories;
create policy "product categories update owner admin"
on public.product_categories for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_categories.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_categories.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "products select authorized" on public.products;
create policy "products select authorized"
on public.products for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    products.status = 'active'
    and products.deleted_at is null
    and exists (
      select 1
      from public.business_members bm
      join public.employees e
        on e.member_id = bm.id and e.business_id = bm.business_id
      join public.shift_assignments sa
        on sa.employee_id = e.id and sa.business_id = e.business_id
      where bm.business_id = products.business_id
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
        and e.status = 'active'
        and e.deleted_at is null
        and ((e.can_use_pos and products.is_sellable) or e.can_log_production)
        and sa.status in ('assigned', 'confirmed')
    )
  )
);

drop policy if exists "products insert owner admin" on public.products;
create policy "products insert owner admin"
on public.products for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "products update owner admin" on public.products;
create policy "products update owner admin"
on public.products for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = products.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "inventory items select authorized" on public.inventory_items;
create policy "inventory items select authorized"
on public.inventory_items for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    inventory_items.status = 'active'
    and inventory_items.deleted_at is null
    and exists (
      select 1
      from public.business_members bm
      join public.employees e
        on e.member_id = bm.id and e.business_id = bm.business_id
      join public.shift_assignments sa
        on sa.employee_id = e.id and sa.business_id = e.business_id
      where bm.business_id = inventory_items.business_id
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
        and e.status = 'active'
        and e.deleted_at is null
        and (e.can_use_pos or e.can_log_production)
        and sa.status in ('assigned', 'confirmed')
    )
  )
);

drop policy if exists "inventory items insert owner admin" on public.inventory_items;
create policy "inventory items insert owner admin"
on public.inventory_items for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "inventory items update owner admin" on public.inventory_items;
create policy "inventory items update owner admin"
on public.inventory_items for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "recipe items select authorized" on public.product_recipe_items;
create policy "recipe items select authorized"
on public.product_recipe_items for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_recipe_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    product_recipe_items.deleted_at is null
    and exists (
      select 1
      from public.business_members bm
      join public.employees e
        on e.member_id = bm.id and e.business_id = bm.business_id
      join public.shift_assignments sa
        on sa.employee_id = e.id and sa.business_id = e.business_id
      where bm.business_id = product_recipe_items.business_id
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
        and e.status = 'active'
        and e.deleted_at is null
        and (e.can_use_pos or e.can_log_production)
        and sa.status in ('assigned', 'confirmed')
    )
  )
);

drop policy if exists "recipe items insert owner admin" on public.product_recipe_items;
create policy "recipe items insert owner admin"
on public.product_recipe_items for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_recipe_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "recipe items update owner admin" on public.product_recipe_items;
create policy "recipe items update owner admin"
on public.product_recipe_items for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_recipe_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_recipe_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

-- Locations and scheduling ---------------------------------------------------

drop policy if exists "selling locations select authorized" on public.selling_locations;
create policy "selling locations select authorized"
on public.selling_locations for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = selling_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shifts s
    join public.shift_assignments sa
      on sa.shift_id = s.id and sa.business_id = s.business_id
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where s.selling_location_id = selling_locations.id
      and s.business_id = selling_locations.business_id
      and s.deleted_at is null
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "selling locations insert owner admin" on public.selling_locations;
create policy "selling locations insert owner admin"
on public.selling_locations for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = selling_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "selling locations update owner admin" on public.selling_locations;
create policy "selling locations update owner admin"
on public.selling_locations for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = selling_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = selling_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

-- shift_assignments is kept below employees and above shifts in the policy
-- dependency graph. Its own policy never queries shift_assignments or shifts.
drop policy if exists "shift assignments select authorized" on public.shift_assignments;
create policy "shift assignments select authorized"
on public.shift_assignments for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_assignments.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    shift_assignments.status <> 'cancelled'
    and exists (
      select 1
      from public.employees e
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where e.id = shift_assignments.employee_id
        and e.business_id = shift_assignments.business_id
        and e.status = 'active'
        and e.deleted_at is null
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

drop policy if exists "shift assignments insert owner admin" on public.shift_assignments;
create policy "shift assignments insert owner admin"
on public.shift_assignments for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_assignments.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "shift assignments update owner admin" on public.shift_assignments;
create policy "shift assignments update owner admin"
on public.shift_assignments for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_assignments.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_assignments.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "shifts select authorized" on public.shifts;
create policy "shifts select authorized"
on public.shifts for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shifts.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    shifts.deleted_at is null
    and exists (
      select 1
      from public.shift_assignments sa
      join public.employees e
        on e.id = sa.employee_id and e.business_id = sa.business_id
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where sa.shift_id = shifts.id
        and sa.business_id = shifts.business_id
        and sa.status <> 'cancelled'
        and e.status = 'active'
        and e.deleted_at is null
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

drop policy if exists "shifts insert owner admin" on public.shifts;
create policy "shifts insert owner admin"
on public.shifts for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shifts.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "shifts update owner admin" on public.shifts;
create policy "shifts update owner admin"
on public.shifts for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shifts.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shifts.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "shift costs select authorized" on public.shift_costs;
create policy "shift costs select authorized"
on public.shift_costs for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_costs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shift_assignments sa
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where sa.shift_id = shift_costs.shift_id
      and sa.business_id = shift_costs.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "shift costs insert owner admin" on public.shift_costs;
create policy "shift costs insert owner admin"
on public.shift_costs for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_costs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "shift costs update owner admin" on public.shift_costs;
create policy "shift costs update owner admin"
on public.shift_costs for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_costs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_costs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

-- Inventory reads ------------------------------------------------------------
-- Ledger, balance, and count writes are intentionally server-only so an
-- inventory balance can never be changed without its matching ledger event.

drop policy if exists "inventory locations select authorized" on public.inventory_locations;
create policy "inventory locations select authorized"
on public.inventory_locations for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    inventory_locations.shift_id is not null
    and inventory_locations.deleted_at is null
    and exists (
      select 1
      from public.shift_assignments sa
      join public.employees e
        on e.id = sa.employee_id and e.business_id = sa.business_id
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where sa.shift_id = inventory_locations.shift_id
        and sa.business_id = inventory_locations.business_id
        and sa.status <> 'cancelled'
        and e.status = 'active'
        and e.deleted_at is null
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

drop policy if exists "inventory locations insert owner admin" on public.inventory_locations;
create policy "inventory locations insert owner admin"
on public.inventory_locations for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "inventory locations update owner admin" on public.inventory_locations;
create policy "inventory locations update owner admin"
on public.inventory_locations for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_locations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "inventory events select authorized" on public.inventory_events;
create policy "inventory events select authorized"
on public.inventory_events for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_events.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    inventory_events.shift_id is not null
    and exists (
      select 1
      from public.shift_assignments sa
      join public.employees e
        on e.id = sa.employee_id and e.business_id = sa.business_id
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where sa.shift_id = inventory_events.shift_id
        and sa.business_id = inventory_events.business_id
        and sa.status <> 'cancelled'
        and e.status = 'active'
        and e.deleted_at is null
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

drop policy if exists "inventory event lines select authorized" on public.inventory_event_lines;
create policy "inventory event lines select authorized"
on public.inventory_event_lines for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_event_lines.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.inventory_events ie
    join public.shift_assignments sa
      on sa.shift_id = ie.shift_id and sa.business_id = ie.business_id
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where ie.id = inventory_event_lines.event_id
      and ie.business_id = inventory_event_lines.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "inventory balances select authorized" on public.inventory_balances;
create policy "inventory balances select authorized"
on public.inventory_balances for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_balances.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.inventory_locations il
    join public.shift_assignments sa
      on sa.shift_id = il.shift_id and sa.business_id = il.business_id
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where il.id = inventory_balances.inventory_location_id
      and il.business_id = inventory_balances.business_id
      and il.deleted_at is null
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "shift inventory counts select authorized" on public.shift_inventory_counts;
create policy "shift inventory counts select authorized"
on public.shift_inventory_counts for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_inventory_counts.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shift_assignments sa
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where sa.shift_id = shift_inventory_counts.shift_id
      and sa.business_id = shift_inventory_counts.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

-- Production and POS reads ---------------------------------------------------
-- These branches test employees.can_log_production / employees.can_use_pos
-- directly. Member role "operator" is never treated as a permission flag.

drop policy if exists "production logs select authorized" on public.production_logs;
create policy "production logs select authorized"
on public.production_logs for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = production_logs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    production_logs.shift_id is not null
    and exists (
      select 1
      from public.shift_assignments sa
      join public.employees e
        on e.id = sa.employee_id and e.business_id = sa.business_id
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where sa.shift_id = production_logs.shift_id
        and sa.business_id = production_logs.business_id
        and sa.status <> 'cancelled'
        and e.status = 'active'
        and e.deleted_at is null
        and e.can_log_production
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

drop policy if exists "sales select authorized" on public.sales;
create policy "sales select authorized"
on public.sales for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = sales.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shift_assignments sa
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where sa.shift_id = sales.shift_id
      and sa.business_id = sales.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_use_pos
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "sale items select authorized" on public.sale_items;
create policy "sale items select authorized"
on public.sale_items for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = sale_items.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.sales s
    join public.shift_assignments sa
      on sa.shift_id = s.shift_id and sa.business_id = s.business_id
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where s.id = sale_items.sale_id
      and s.business_id = sale_items.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_use_pos
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "payments select authorized" on public.payments;
create policy "payments select authorized"
on public.payments for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = payments.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.sales s
    join public.shift_assignments sa
      on sa.shift_id = s.shift_id and sa.business_id = s.business_id
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where s.id = payments.sale_id
      and s.business_id = payments.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_use_pos
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "files select authorized" on public.files;
create policy "files select authorized"
on public.files for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = files.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    files.bucket_id = 'payment-proofs'
    and files.file_type = 'payment_proof'
    and exists (
      select 1
      from public.payments p
      join public.sales s
        on s.id = p.sale_id and s.business_id = p.business_id
      join public.shift_assignments sa
        on sa.shift_id = s.shift_id and sa.business_id = s.business_id
      join public.employees e
        on e.id = sa.employee_id and e.business_id = sa.business_id
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where p.proof_file_id = files.id
        and p.business_id = files.business_id
        and p.payment_method <> 'cash'
        and sa.status <> 'cancelled'
        and e.status = 'active'
        and e.deleted_at is null
        and e.can_use_pos
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

-- Requests and approvals -----------------------------------------------------
-- Request creation and every approval mutation are server-only. Employees can
-- read only their own assigned-shift requests; owners/admins can read all.

drop policy if exists "sale change requests select authorized" on public.sale_change_requests;
create policy "sale change requests select authorized"
on public.sale_change_requests for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = sale_change_requests.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.sales s
    join public.shift_assignments sa
      on sa.shift_id = s.shift_id and sa.business_id = s.business_id
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where s.id = sale_change_requests.sale_id
      and s.business_id = sale_change_requests.business_id
      and e.id = sale_change_requests.requested_by
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_use_pos
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "cash deductions select authorized" on public.cash_deductions;
create policy "cash deductions select authorized"
on public.cash_deductions for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = cash_deductions.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shift_assignments sa
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where sa.shift_id = cash_deductions.shift_id
      and sa.business_id = cash_deductions.business_id
      and e.id = cash_deductions.requested_by
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "inventory adjustments select authorized" on public.inventory_adjustments;
create policy "inventory adjustments select authorized"
on public.inventory_adjustments for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = inventory_adjustments.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    inventory_adjustments.shift_id is not null
    and exists (
      select 1
      from public.shift_assignments sa
      join public.employees e
        on e.id = sa.employee_id and e.business_id = sa.business_id
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where sa.shift_id = inventory_adjustments.shift_id
        and sa.business_id = inventory_adjustments.business_id
        and e.id = inventory_adjustments.requested_by
        and sa.status <> 'cancelled'
        and e.status = 'active'
        and e.deleted_at is null
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);

-- Closeout and profit --------------------------------------------------------

drop policy if exists "shift closeouts select authorized" on public.shift_closeouts;
create policy "shift closeouts select authorized"
on public.shift_closeouts for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_closeouts.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shift_assignments sa
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where sa.shift_id = shift_closeouts.shift_id
      and sa.business_id = shift_closeouts.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_use_pos
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "cash reconciliations select authorized" on public.cash_reconciliations;
create policy "cash reconciliations select authorized"
on public.cash_reconciliations for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = cash_reconciliations.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shift_closeouts sc
    join public.shift_assignments sa
      on sa.shift_id = sc.shift_id and sa.business_id = sc.business_id
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where sc.id = cash_reconciliations.closeout_id
      and sc.business_id = cash_reconciliations.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_use_pos
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

drop policy if exists "shift profit summaries select authorized" on public.shift_profit_summaries;
create policy "shift profit summaries select authorized"
on public.shift_profit_summaries for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = shift_profit_summaries.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.shift_assignments sa
    join public.employees e
      on e.id = sa.employee_id and e.business_id = sa.business_id
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where sa.shift_id = shift_profit_summaries.shift_id
      and sa.business_id = shift_profit_summaries.business_id
      and sa.status <> 'cancelled'
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_use_pos
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

-- Sync and audit -------------------------------------------------------------

drop policy if exists "offline sync actions select authorized" on public.offline_sync_actions;
create policy "offline sync actions select authorized"
on public.offline_sync_actions for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = offline_sync_actions.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and (
        bm.role in ('owner', 'admin')
        or offline_sync_actions.created_by = (select auth.uid())
      )
  )
);

drop policy if exists "audit logs select authorized" on public.audit_logs;
create policy "audit logs select authorized"
on public.audit_logs for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = audit_logs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    audit_logs.actor_user_id = (select auth.uid())
    and exists (
      select 1 from public.business_members bm
      where bm.business_id = audit_logs.business_id
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
  or exists (
    select 1
    from public.employees e
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where e.id = audit_logs.actor_employee_id
      and e.business_id = audit_logs.business_id
      and e.status = 'active'
      and e.deleted_at is null
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
  )
);

-- Stock movement is an inventory-ledger workflow, so browser access is
-- read-only and limited to owners/admins. All writes remain server-only.

drop policy if exists "stock receivings select owner admin" on public.stock_receivings;
create policy "stock receivings select owner admin"
on public.stock_receivings for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_receivings.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "stock receiving lines select owner admin" on public.stock_receiving_lines;
create policy "stock receiving lines select owner admin"
on public.stock_receiving_lines for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_receiving_lines.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "stock transfers select owner admin" on public.stock_transfers;
create policy "stock transfers select owner admin"
on public.stock_transfers for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_transfers.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "stock transfer lines select owner admin" on public.stock_transfer_lines;
create policy "stock transfer lines select owner admin"
on public.stock_transfer_lines for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = stock_transfer_lines.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

-- Promotions ----------------------------------------------------------------

drop policy if exists "promo rules select authorized" on public.promo_rules;
create policy "promo rules select authorized"
on public.promo_rules for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = promo_rules.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  or (
    promo_rules.status = 'active'
    and (promo_rules.starts_at is null or promo_rules.starts_at <= now())
    and (promo_rules.ends_at is null or promo_rules.ends_at >= now())
    and exists (
      select 1
      from public.business_members bm
      join public.employees e
        on e.member_id = bm.id and e.business_id = bm.business_id
      join public.shift_assignments sa
        on sa.employee_id = e.id and sa.business_id = e.business_id
      where bm.business_id = promo_rules.business_id
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
        and e.status = 'active'
        and e.deleted_at is null
        and e.can_use_pos
        and sa.status in ('assigned', 'confirmed')
    )
  )
);

drop policy if exists "promo rules insert owner admin" on public.promo_rules;
create policy "promo rules insert owner admin"
on public.promo_rules for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = promo_rules.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

drop policy if exists "promo rules update owner admin" on public.promo_rules;
create policy "promo rules update owner admin"
on public.promo_rules for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = promo_rules.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = promo_rules.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);
