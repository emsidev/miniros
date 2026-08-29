-- The linked project already contained this unrelated helper. It is not part of
-- MINIROS and remains inaccessible through the Data API. We revoke its default
-- PUBLIC execute grant instead of making a destructive change to external state.
do $legacy_helper$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$legacy_helper$;
