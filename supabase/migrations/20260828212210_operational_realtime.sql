-- MINIROS selective Realtime publication
-- Apply after the Drizzle-generated schema migration and RLS policies.
--
-- PostgreSQL has no ALTER PUBLICATION ... ADD TABLE IF NOT EXISTS form. This
-- anonymous, non-persistent block checks the catalog before each ADD, making
-- repeated application safe without replacing unrelated publication members.
-- It creates no persistent database helper or trigger.

do $realtime$
declare
  target_table text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  for target_table in
    select table_name
    from (
      values
        ('shifts'),
        ('shift_assignments'),
        ('sales'),
        ('payments'),
        ('production_logs'),
        ('inventory_events'),
        ('inventory_balances'),
        ('cash_deductions'),
        ('inventory_adjustments'),
        ('shift_closeouts'),
        ('offline_sync_actions')
    ) as realtime_tables(table_name)
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      raise exception 'Realtime target public.% does not exist', target_table;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format(
        'alter publication %I add table public.%I',
        'supabase_realtime',
        target_table
      );
    end if;
  end loop;
end
$realtime$;
