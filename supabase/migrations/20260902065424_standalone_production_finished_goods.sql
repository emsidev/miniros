create table public.product_production_outputs (
  product_id uuid primary key references public.products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index product_production_outputs_business_id_idx
  on public.product_production_outputs using btree (business_id);
create unique index product_production_outputs_business_inventory_item_unique
  on public.product_production_outputs using btree (business_id, inventory_item_id);

alter table public.product_production_outputs enable row level security;
revoke all privileges on table public.product_production_outputs from public, anon, authenticated;
grant select, insert, update, delete on table public.product_production_outputs to authenticated;
grant select, insert, update, delete on table public.product_production_outputs to service_role;

create policy "production outputs select owner admin"
on public.product_production_outputs for select to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_production_outputs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  and exists (
    select 1 from public.products p
    where p.id = product_production_outputs.product_id
      and p.business_id = product_production_outputs.business_id
  )
  and exists (
    select 1 from public.inventory_items i
    where i.id = product_production_outputs.inventory_item_id
      and i.business_id = product_production_outputs.business_id
  )
);

create policy "production outputs insert owner admin"
on public.product_production_outputs for insert to authenticated
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_production_outputs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  and exists (
    select 1 from public.products p
    where p.id = product_production_outputs.product_id
      and p.business_id = product_production_outputs.business_id
  )
  and exists (
    select 1 from public.inventory_items i
    where i.id = product_production_outputs.inventory_item_id
      and i.business_id = product_production_outputs.business_id
  )
);

create policy "production outputs update owner admin"
on public.product_production_outputs for update to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_production_outputs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  and exists (
    select 1 from public.products p
    where p.id = product_production_outputs.product_id
      and p.business_id = product_production_outputs.business_id
  )
  and exists (
    select 1 from public.inventory_items i
    where i.id = product_production_outputs.inventory_item_id
      and i.business_id = product_production_outputs.business_id
  )
)
with check (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_production_outputs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
  and exists (
    select 1 from public.products p
    where p.id = product_production_outputs.product_id
      and p.business_id = product_production_outputs.business_id
  )
  and exists (
    select 1 from public.inventory_items i
    where i.id = product_production_outputs.inventory_item_id
      and i.business_id = product_production_outputs.business_id
  )
);

create policy "production outputs delete owner admin"
on public.product_production_outputs for delete to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = product_production_outputs.business_id
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
      and bm.role in ('owner', 'admin')
  )
);

alter table public.shift_profit_summaries
  add column product_cost_cents bigint not null default 0;

with cost_of_goods as (
  select
    sales.shift_id,
    coalesce(sum(round(sale_items.unit_cost_cents::numeric * sale_items.quantity)), 0)::bigint as product_cost_cents
  from public.sales
  join public.sale_items
    on sale_items.sale_id = sales.id
   and sale_items.business_id = sales.business_id
  where sales.status = 'completed'
  group by sales.shift_id
), recalculated as (
  select
    summary.id,
    coalesce(cost_of_goods.product_cost_cents, 0) as product_cost_cents,
    summary.salary_cost_cents
      + summary.rental_cost_cents
      + summary.transport_cost_cents
      + summary.approved_deductions_cents
      + summary.other_costs_cents
      + coalesce(cost_of_goods.product_cost_cents, 0) as total_costs_cents
  from public.shift_profit_summaries summary
  left join cost_of_goods on cost_of_goods.shift_id = summary.shift_id
)
update public.shift_profit_summaries summary
set
  product_cost_cents = recalculated.product_cost_cents,
  total_costs_cents = recalculated.total_costs_cents,
  profit_cents = summary.gross_sales_cents - recalculated.total_costs_cents,
  result = case
    when summary.gross_sales_cents - recalculated.total_costs_cents > 0 then 'profit'::public.profit_result
    when summary.gross_sales_cents - recalculated.total_costs_cents < 0 then 'loss'::public.profit_result
    else 'break_even'::public.profit_result
  end
from recalculated
where summary.id = recalculated.id;

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
  or exists (
    select 1
    from public.employees e
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    where e.id = production_logs.logged_by
      and e.business_id = production_logs.business_id
      and e.status = 'active'
      and e.deleted_at is null
      and e.can_log_production
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.deleted_at is null
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
