-- MINIROS RLS scaffold
-- Apply after Drizzle-generated table migrations.
-- No Supabase RPC functions, stored procedures, or business-logic triggers are used here.

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

-- Profiles
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Businesses
create policy "members can read their businesses"
on public.businesses
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = businesses.id
      and bm.auth_user_id = auth.uid()
      and bm.status = 'active'
  )
);

-- Business members
create policy "members can read business members"
on public.business_members
for select
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_members.business_id
      and bm.auth_user_id = auth.uid()
      and bm.status = 'active'
  )
);

create policy "owners and admins can manage members"
on public.business_members
for all
to authenticated
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_members.business_id
      and bm.auth_user_id = auth.uid()
      and bm.status = 'active'
      and bm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_members.business_id
      and bm.auth_user_id = auth.uid()
      and bm.status = 'active'
      and bm.role in ('owner', 'admin')
  )
);

-- Generic member read policies for business-scoped tables.
create policy "members can read employees" on public.employees for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = employees.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read products" on public.products for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = products.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read product categories" on public.product_categories for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = product_categories.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read inventory items" on public.inventory_items for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = inventory_items.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read recipes" on public.product_recipe_items for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = product_recipe_items.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read locations" on public.selling_locations for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = selling_locations.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read shifts" on public.shifts for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = shifts.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read shift assignments" on public.shift_assignments for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = shift_assignments.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read inventory balances" on public.inventory_balances for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = inventory_balances.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read sales" on public.sales for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = sales.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read payments" on public.payments for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = payments.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read production logs" on public.production_logs for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = production_logs.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read closeouts" on public.shift_closeouts for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = shift_closeouts.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));
create policy "members can read profit summaries" on public.shift_profit_summaries for select to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = shift_profit_summaries.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active'));

-- Admin setup write policies.
create policy "admins can manage products" on public.products for all to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = products.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin'))) with check (exists (select 1 from public.business_members bm where bm.business_id = products.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin')));
create policy "admins can manage inventory items" on public.inventory_items for all to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = inventory_items.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin'))) with check (exists (select 1 from public.business_members bm where bm.business_id = inventory_items.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin')));
create policy "admins can manage locations" on public.selling_locations for all to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = selling_locations.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin'))) with check (exists (select 1 from public.business_members bm where bm.business_id = selling_locations.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin')));
create policy "admins can manage shifts" on public.shifts for all to authenticated using (exists (select 1 from public.business_members bm where bm.business_id = shifts.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin'))) with check (exists (select 1 from public.business_members bm where bm.business_id = shifts.business_id and bm.auth_user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner', 'admin')));
