alter table public.companies
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists nit text,
  add column if not exists verification_digit text,
  add column if not exists entity_type text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists department text,
  add column if not exists country text not null default 'Colombia',
  add column if not exists postal_code text,
  add column if not exists phone text,
  add column if not exists mobile text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists legal_representative text,
  add column if not exists representative_document text,
  add column if not exists incorporation_date date,
  add column if not exists chamber_registration text,
  add column if not exists social_capital numeric not null default 0 check (social_capital >= 0),
  add column if not exists paid_in_capital numeric not null default 0 check (paid_in_capital >= 0),
  add column if not exists tax_regime text,
  add column if not exists tax_responsibilities text,
  add column if not exists withholding_agent boolean not null default false,
  add column if not exists industry_commerce_taxpayer boolean not null default false,
  add column if not exists invoice_resolution text,
  add column if not exists notes text;

create table if not exists public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  position text,
  contact_type text not null default 'ADMINISTRATIVE',
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.company_ciiu_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  description text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.company_tax_calendar (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  obligation text not null,
  tax_year integer not null default extract(year from current_date)::integer,
  period text,
  due_date date not null,
  status text not null default 'PENDING' check (status in ('PENDING','FILED','PAID','NOT_APPLICABLE')),
  amount numeric check (amount is null or amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_contacts_company on public.company_contacts(company_id);
create index if not exists idx_company_ciiu_company on public.company_ciiu_codes(company_id);
create index if not exists idx_company_tax_calendar_due on public.company_tax_calendar(company_id, due_date);

alter table public.company_contacts enable row level security;
alter table public.company_ciiu_codes enable row level security;
alter table public.company_tax_calendar enable row level security;

create policy company_contacts_access on public.company_contacts for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_contacts.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_contacts.company_id and p.is_active));
create policy company_ciiu_access on public.company_ciiu_codes for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_ciiu_codes.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_ciiu_codes.company_id and p.is_active));
create policy company_tax_calendar_access on public.company_tax_calendar for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_tax_calendar.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=company_tax_calendar.company_id and p.is_active));

grant select,insert,update,delete on public.company_contacts, public.company_ciiu_codes, public.company_tax_calendar to authenticated;
