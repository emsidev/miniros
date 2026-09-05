-- Calendar discovery only. Assignment, cost, sale, and write policies are unchanged.
-- Keep the dependency graph employee -> membership acyclic.
create policy "employees read published schedule"
on public.shifts for select to authenticated
using (
  deleted_at is null
  and status in ('scheduled', 'active', 'closing', 'closed')
  and exists (
    select 1 from public.employees e
    join public.business_members bm
      on bm.id = e.member_id and bm.business_id = e.business_id
    join public.businesses b on b.id = e.business_id
    where e.business_id = shifts.business_id
      and e.status = 'active' and e.deleted_at is null
      and (e.can_use_pos or not e.can_log_production)
      and bm.auth_user_id = (select auth.uid())
      and bm.status = 'active' and bm.deleted_at is null
      and b.status = 'active' and b.deleted_at is null
  )
);
