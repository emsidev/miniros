-- MINIROS payment proof storage scaffold
-- Private bucket. File paths must start with the business_id.

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "members can upload payment proofs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.business_members bm
    where bm.auth_user_id = auth.uid()
      and bm.status = 'active'
      and name like bm.business_id::text || '/%'
  )
);

create policy "members can read payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.business_members bm
    where bm.auth_user_id = auth.uid()
      and bm.status = 'active'
      and name like bm.business_id::text || '/%'
  )
);
