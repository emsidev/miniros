-- MINIROS Realtime scaffold
-- Apply after Drizzle-generated table migrations.
-- Enable realtime only for operational tables that benefit from live updates.

alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.shift_assignments;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.production_logs;
alter publication supabase_realtime add table public.inventory_events;
alter publication supabase_realtime add table public.inventory_balances;
alter publication supabase_realtime add table public.cash_deductions;
alter publication supabase_realtime add table public.inventory_adjustments;
alter publication supabase_realtime add table public.shift_closeouts;
alter publication supabase_realtime add table public.offline_sync_actions;
