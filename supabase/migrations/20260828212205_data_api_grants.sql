-- MINIROS explicit Data API grants
-- Apply after 001-enable-rls-and-policies.sql.
--
-- Supabase no longer guarantees that new public tables receive implicit Data
-- API grants. Grants decide which operations reach RLS; policies decide which
-- rows those operations can affect. Keep the browser role read-mostly and use
-- the server-only secret/service role for critical multi-table workflows.

grant usage on schema public to authenticated, service_role;

-- Remove legacy/default exposure first. PUBLIC and anon receive no access to
-- business data, and authenticated gets only the operations granted below.
revoke all privileges on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.employees,
  public.product_categories,
  public.products,
  public.inventory_items,
  public.product_recipe_items,
  public.selling_locations,
  public.shifts,
  public.shift_assignments,
  public.shift_costs,
  public.inventory_locations,
  public.inventory_events,
  public.inventory_event_lines,
  public.inventory_balances,
  public.shift_inventory_counts,
  public.production_logs,
  public.sales,
  public.sale_items,
  public.payments,
  public.files,
  public.sale_change_requests,
  public.cash_deductions,
  public.inventory_adjustments,
  public.shift_closeouts,
  public.cash_reconciliations,
  public.shift_profit_summaries,
  public.offline_sync_actions,
  public.audit_logs,
  public.stock_receivings,
  public.stock_receiving_lines,
  public.stock_transfers,
  public.stock_transfer_lines,
  public.promo_rules
from PUBLIC, anon, authenticated;

-- Browser-safe reads. RLS still filters every row.
grant select on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.employees,
  public.product_categories,
  public.products,
  public.inventory_items,
  public.product_recipe_items,
  public.selling_locations,
  public.shifts,
  public.shift_assignments,
  public.shift_costs,
  public.inventory_locations,
  public.inventory_events,
  public.inventory_event_lines,
  public.inventory_balances,
  public.shift_inventory_counts,
  public.production_logs,
  public.sales,
  public.sale_items,
  public.payments,
  public.files,
  public.sale_change_requests,
  public.cash_deductions,
  public.inventory_adjustments,
  public.shift_closeouts,
  public.cash_reconciliations,
  public.shift_profit_summaries,
  public.offline_sync_actions,
  public.audit_logs,
  public.stock_receivings,
  public.stock_receiving_lines,
  public.stock_transfers,
  public.stock_transfer_lines,
  public.promo_rules
to authenticated;

-- A signed-in user may create and maintain only their own profile row.
grant insert, update on table public.profiles to authenticated;

-- Owner/admin setup mutations. No DELETE grant is exposed: setup records use
-- status/deleted_at soft deletion where the current schema supports it.
grant update on table public.businesses to authenticated;

grant insert, update on table
  public.employees,
  public.product_categories,
  public.products,
  public.inventory_items,
  public.product_recipe_items,
  public.selling_locations,
  public.shifts,
  public.shift_assignments,
  public.shift_costs,
  public.inventory_locations,
  public.promo_rules
to authenticated;

-- Server-side workflows need DML but do not need TRUNCATE, REFERENCES, or
-- TRIGGER privileges. The service role bypasses RLS and must never reach a
-- public client; server services must re-check membership and permissions.
grant select, insert, update, delete on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.employees,
  public.product_categories,
  public.products,
  public.inventory_items,
  public.product_recipe_items,
  public.selling_locations,
  public.shifts,
  public.shift_assignments,
  public.shift_costs,
  public.inventory_locations,
  public.inventory_events,
  public.inventory_event_lines,
  public.inventory_balances,
  public.shift_inventory_counts,
  public.production_logs,
  public.sales,
  public.sale_items,
  public.payments,
  public.files,
  public.sale_change_requests,
  public.cash_deductions,
  public.inventory_adjustments,
  public.shift_closeouts,
  public.cash_reconciliations,
  public.shift_profit_summaries,
  public.offline_sync_actions,
  public.audit_logs,
  public.stock_receivings,
  public.stock_receiving_lines,
  public.stock_transfers,
  public.stock_transfer_lines,
  public.promo_rules
to service_role;
