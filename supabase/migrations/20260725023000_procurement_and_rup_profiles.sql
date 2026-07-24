alter table public.secop_profiles
  add column sectors text[] not null default '{}',
  add column modalities text[] not null default '{}',
  add column municipalities text[] not null default '{}',
  add column preferred_entities text[] not null default '{}',
  add column excluded_entities text[] not null default '{}',
  add column required_keywords text[] not null default '{}';

create table public.rup_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  issue_date date,
  valid_until date,
  fiscal_year integer,
  current_assets numeric not null default 0,
  current_liabilities numeric not null default 0,
  total_assets numeric not null default 0,
  total_liabilities numeric not null default 0,
  equity numeric not null default 0,
  operating_profit numeric not null default 0,
  interest_expense numeric not null default 0,
  net_income numeric not null default 0,
  residual_capacity numeric not null default 0,
  is_mipyme boolean not null default false,
  domicile text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rup_experiences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_number text,
  client text not null,
  contract_object text not null,
  completion_date date,
  value_cop numeric not null default 0,
  value_smmlv numeric not null default 0,
  unspsc_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_rup_experiences_company on public.rup_experiences(company_id);

alter table public.secop_opportunities
  add column required_liquidity numeric,
  add column max_indebtedness numeric,
  add column min_interest_coverage numeric,
  add column min_roe numeric,
  add column min_roa numeric,
  add column required_experience_smmlv numeric,
  add column required_experience_unspsc text[] not null default '{}',
  add column eligibility_status text not null default 'REVIEW'
    check (eligibility_status in ('ELIGIBLE','NOT_ELIGIBLE','REVIEW')),
  add column eligibility_score integer
    check (eligibility_score is null or eligibility_score between 0 and 100),
  add column eligibility_reasons jsonb not null default '[]'::jsonb,
  add column requirements_reviewed_at timestamptz;

alter table public.rup_profiles enable row level security;
alter table public.rup_experiences enable row level security;

create policy rup_profiles_company_access on public.rup_profiles for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=rup_profiles.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=rup_profiles.company_id and p.is_active));
create policy rup_experiences_company_access on public.rup_experiences for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=rup_experiences.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=rup_experiences.company_id and p.is_active));

grant select, insert, update, delete on public.rup_profiles to authenticated;
grant select, insert, update, delete on public.rup_experiences to authenticated;
