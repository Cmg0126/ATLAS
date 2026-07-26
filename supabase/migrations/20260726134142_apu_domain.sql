create table public.apu_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  unit text not null default 'UND',
  system_id uuid references public.product_systems(id) on delete set null,
  category_id uuid references public.product_categories(id) on delete set null,
  subcategory_id uuid references public.product_subcategories(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  administration_percent numeric not null default 0 check (administration_percent between 0 and 100),
  contingency_percent numeric not null default 0 check (contingency_percent between 0 and 100),
  profit_percent numeric not null default 0 check (profit_percent between 0 and 100),
  tax_on_profit_percent numeric not null default 19 check (tax_on_profit_percent between 0 and 100),
  direct_cost numeric not null default 0 check (direct_cost >= 0),
  administration_cost numeric not null default 0 check (administration_cost >= 0),
  contingency_cost numeric not null default 0 check (contingency_cost >= 0),
  profit_cost numeric not null default 0 check (profit_cost >= 0),
  tax_cost numeric not null default 0 check (tax_cost >= 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  version integer not null default 1 check (version > 0),
  source_apu_id uuid references public.apu_templates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code, version)
);

create table public.apu_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  apu_id uuid not null references public.apu_templates(id) on delete cascade,
  item_type text not null check (item_type in ('MATERIAL','LABOR','EQUIPMENT','TRANSPORT','SUBCONTRACT','OTHER')),
  catalog_product_id uuid references public.catalog_products(id) on delete set null,
  supplier_price_id uuid references public.supplier_prices(id) on delete set null,
  code text,
  description text not null,
  unit text not null default 'UND',
  quantity numeric not null default 1 check (quantity >= 0),
  performance numeric not null default 1 check (performance > 0),
  waste_percent numeric not null default 0 check (waste_percent between 0 and 100),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  subtotal numeric not null default 0 check (subtotal >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index apu_templates_company_status_idx on public.apu_templates(company_id, status, name);
create index apu_items_apu_type_idx on public.apu_items(apu_id, item_type, sort_order);

alter table public.apu_templates enable row level security;
alter table public.apu_items enable row level security;

create policy apu_templates_company_access on public.apu_templates
for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.company_id = apu_templates.company_id and p.is_active
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.company_id = apu_templates.company_id and p.is_active
));

create policy apu_items_company_access on public.apu_items
for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.company_id = apu_items.company_id and p.is_active
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.company_id = apu_items.company_id and p.is_active
));

grant select, insert, update, delete on public.apu_templates to authenticated;
grant select, insert, update, delete on public.apu_items to authenticated;
