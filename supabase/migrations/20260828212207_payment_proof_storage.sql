-- MINIROS private payment-proof storage
-- Required object path: {business_id}/payments/{payment_id}/{file_name}
--
-- The payment row must exist before the browser uploads its proof. Creating the
-- payment remains a server-side workflow; the assigned operator can then upload
-- or upsert the object while the shift is active/closing.

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update
set name = excluded.name,
    public = false;

grant usage on schema storage to authenticated;
grant select, insert, update on table storage.objects to authenticated;

drop policy if exists "members can upload payment proofs" on storage.objects;
drop policy if exists "members can read payment proofs" on storage.objects;
drop policy if exists "payment proofs select authorized" on storage.objects;
drop policy if exists "payment proofs insert authorized" on storage.objects;
drop policy if exists "payment proofs update authorized" on storage.objects;

-- Owners/admins may read proofs for any payment in an active membership.
-- Operators must be active employees with can_use_pos and a non-cancelled
-- assignment to the payment's shift.
create policy "payment proofs select authorized"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[2] = 'payments'
  and coalesce(storage.filename(name), '') <> ''
  and exists (
    select 1
    from public.payments p
    join public.sales s
      on s.id = p.sale_id
     and s.business_id = p.business_id
    join public.shifts sh
      on sh.id = s.shift_id
     and sh.business_id = s.business_id
    where p.payment_method <> 'cash'
      and p.business_id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[3]
      and exists (
        select 1
        from public.business_members bm
        where bm.business_id = p.business_id
          and bm.auth_user_id = (select auth.uid())
          and bm.status = 'active'
          and bm.deleted_at is null
          and (
            bm.role in ('owner', 'admin')
            or exists (
              select 1
              from public.employees e
              join public.shift_assignments sa
                on sa.employee_id = e.id
               and sa.business_id = e.business_id
              where e.member_id = bm.id
                and e.business_id = bm.business_id
                and e.status = 'active'
                and e.deleted_at is null
                and e.can_use_pos
                and sa.shift_id = sh.id
                and sa.status <> 'cancelled'
            )
          )
      )
  )
);

-- INSERT authorizes the new object path. For operators, upload is limited to
-- an assigned/confirmed active workflow. Owners/admins retain repair access.
create policy "payment proofs insert authorized"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[2] = 'payments'
  and coalesce(storage.filename(name), '') <> ''
  and exists (
    select 1
    from public.payments p
    join public.sales s
      on s.id = p.sale_id
     and s.business_id = p.business_id
    join public.shifts sh
      on sh.id = s.shift_id
     and sh.business_id = s.business_id
    where p.payment_method <> 'cash'
      and p.business_id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[3]
      and exists (
        select 1
        from public.business_members bm
        where bm.business_id = p.business_id
          and bm.auth_user_id = (select auth.uid())
          and bm.status = 'active'
          and bm.deleted_at is null
          and (
            bm.role in ('owner', 'admin')
            or exists (
              select 1
              from public.employees e
              join public.shift_assignments sa
                on sa.employee_id = e.id
               and sa.business_id = e.business_id
              where e.member_id = bm.id
                and e.business_id = bm.business_id
                and e.status = 'active'
                and e.deleted_at is null
                and e.can_use_pos
                and sa.shift_id = sh.id
                and sa.status in ('assigned', 'confirmed')
                and sh.status in ('active', 'closing')
            )
          )
      )
  )
);

-- Storage upsert requires SELECT, INSERT, and UPDATE policies. USING protects
-- the existing row; WITH CHECK separately protects its resulting bucket/path.
create policy "payment proofs update authorized"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-proofs'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[2] = 'payments'
  and coalesce(storage.filename(name), '') <> ''
  and exists (
    select 1
    from public.payments p
    join public.sales s
      on s.id = p.sale_id
     and s.business_id = p.business_id
    join public.shifts sh
      on sh.id = s.shift_id
     and sh.business_id = s.business_id
    where p.payment_method <> 'cash'
      and p.business_id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[3]
      and exists (
        select 1
        from public.business_members bm
        where bm.business_id = p.business_id
          and bm.auth_user_id = (select auth.uid())
          and bm.status = 'active'
          and bm.deleted_at is null
          and (
            bm.role in ('owner', 'admin')
            or exists (
              select 1
              from public.employees e
              join public.shift_assignments sa
                on sa.employee_id = e.id
               and sa.business_id = e.business_id
              where e.member_id = bm.id
                and e.business_id = bm.business_id
                and e.status = 'active'
                and e.deleted_at is null
                and e.can_use_pos
                and sa.shift_id = sh.id
                and sa.status in ('assigned', 'confirmed')
                and sh.status in ('active', 'closing')
            )
          )
      )
  )
)
with check (
  bucket_id = 'payment-proofs'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[2] = 'payments'
  and coalesce(storage.filename(name), '') <> ''
  and exists (
    select 1
    from public.payments p
    join public.sales s
      on s.id = p.sale_id
     and s.business_id = p.business_id
    join public.shifts sh
      on sh.id = s.shift_id
     and sh.business_id = s.business_id
    where p.payment_method <> 'cash'
      and p.business_id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[3]
      and exists (
        select 1
        from public.business_members bm
        where bm.business_id = p.business_id
          and bm.auth_user_id = (select auth.uid())
          and bm.status = 'active'
          and bm.deleted_at is null
          and (
            bm.role in ('owner', 'admin')
            or exists (
              select 1
              from public.employees e
              join public.shift_assignments sa
                on sa.employee_id = e.id
               and sa.business_id = e.business_id
              where e.member_id = bm.id
                and e.business_id = bm.business_id
                and e.status = 'active'
                and e.deleted_at is null
                and e.can_use_pos
                and sa.shift_id = sh.id
                and sa.status in ('assigned', 'confirmed')
                and sh.status in ('active', 'closing')
            )
          )
      )
  )
);
