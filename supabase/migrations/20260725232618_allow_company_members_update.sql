create policy companies_member_update
on public.companies
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id = companies.id
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id = companies.id
      and p.is_active = true
  )
);
