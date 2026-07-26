create table if not exists public.reusable_tender_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null,
  name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint not null default 0,
  issue_date date,
  valid_until date,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reusable_tender_documents_company
  on public.reusable_tender_documents(company_id, category);
create index if not exists idx_reusable_tender_documents_uploaded_by
  on public.reusable_tender_documents(uploaded_by);

alter table public.reusable_tender_documents enable row level security;

create policy reusable_tender_documents_company_access
on public.reusable_tender_documents
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id = reusable_tender_documents.company_id
      and p.is_active
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id = reusable_tender_documents.company_id
      and p.is_active
  )
);

grant select, insert, update, delete on public.reusable_tender_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tender-documents',
  'tender-documents',
  false,
  15728640,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy tender_documents_select
on storage.objects for select to authenticated
using (
  bucket_id = 'tender-documents'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id::text = (storage.foldername(name))[1]
      and p.is_active
  )
);

create policy tender_documents_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tender-documents'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id::text = (storage.foldername(name))[1]
      and p.is_active
  )
);

create policy tender_documents_update
on storage.objects for update to authenticated
using (
  bucket_id = 'tender-documents'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id::text = (storage.foldername(name))[1]
      and p.is_active
  )
)
with check (
  bucket_id = 'tender-documents'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id::text = (storage.foldername(name))[1]
      and p.is_active
  )
);

create policy tender_documents_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'tender-documents'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.company_id::text = (storage.foldername(name))[1]
      and p.is_active
  )
);
