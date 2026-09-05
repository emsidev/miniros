-- Draft assignments are admin-only. Keep the employee -> assignment -> shift
-- dependency graph acyclic; never query shifts from its assignment policy.
-- Dependent cost/inventory policies inherit this restriction through assignments.
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
    shift_assignments.status in ('assigned', 'confirmed', 'completed')
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
    and shifts.status in ('scheduled', 'active', 'closing', 'closed')
    and exists (
      select 1
      from public.shift_assignments sa
      join public.employees e
        on e.id = sa.employee_id and e.business_id = sa.business_id
      join public.business_members bm
        on bm.id = e.member_id and bm.business_id = e.business_id
      where sa.shift_id = shifts.id
        and sa.business_id = shifts.business_id
        and sa.status in ('assigned', 'confirmed', 'completed')
        and e.status = 'active'
        and e.deleted_at is null
        and bm.auth_user_id = (select auth.uid())
        and bm.status = 'active'
        and bm.deleted_at is null
    )
  )
);
