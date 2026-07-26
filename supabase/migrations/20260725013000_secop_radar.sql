create table public.secop_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  unspsc_codes text[] not null default '{}',
  departments text[] not null default '{}',
  min_value numeric not null default 0,
  max_value numeric not null default 0,
  minimum_days integer not null default 3 check (minimum_days >= 0),
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.secop_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  secop_process_id text not null,
  reference text,
  title text not null,
  description text,
  entity text,
  department text,
  city text,
  phase text,
  process_status text,
  modality text,
  base_price numeric not null default 0,
  publication_date timestamptz,
  submission_date timestamptz,
  unspsc_code text,
  additional_categories text,
  source_url text,
  match_score integer not null default 0 check (match_score between 0 and 100),
  match_reasons jsonb not null default '[]'::jsonb,
  decision text not null default 'NEW' check (decision in ('NEW','REVIEW','DISMISSED','IMPORTED')),
  tender_id uuid references public.tenders(id) on delete set null,
  synced_at timestamptz not null default now(),
  unique(company_id, secop_process_id)
);

create index idx_secop_opportunities_company_score
  on public.secop_opportunities(company_id, decision, match_score desc);
create index idx_secop_opportunities_submission
  on public.secop_opportunities(submission_date);
create index idx_secop_opportunities_tender
  on public.secop_opportunities(tender_id);

alter table public.tenders add column source text not null default 'MANUAL';
alter table public.tenders add column external_id text;
alter table public.tenders add column source_url text;
alter table public.tenders add column match_score integer;
create unique index uq_tenders_company_external
  on public.tenders(company_id, source, external_id) where external_id is not null;

alter table public.secop_profiles enable row level security;
alter table public.secop_opportunities enable row level security;

create policy secop_profiles_company_access on public.secop_profiles for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=secop_profiles.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=secop_profiles.company_id and p.is_active));
create policy secop_opportunities_company_access on public.secop_opportunities for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=secop_opportunities.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=secop_opportunities.company_id and p.is_active));

grant select, insert, update, delete on public.secop_profiles to authenticated;
grant select, insert, update, delete on public.secop_opportunities to authenticated;
