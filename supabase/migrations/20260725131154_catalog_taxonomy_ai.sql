create table public.product_systems (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, normalized_name)
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  system_id uuid not null references public.product_systems(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(system_id, normalized_name)
);

create table public.product_subcategories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, normalized_name)
);

alter table public.catalog_products
  add column system_id uuid references public.product_systems(id) on delete set null,
  add column category_id uuid references public.product_categories(id) on delete set null,
  add column subcategory_id uuid references public.product_subcategories(id) on delete set null,
  add column classification_status text not null default 'PENDING'
    check (classification_status in ('AUTOMATIC','REVIEW','REVIEWED','PENDING')),
  add column classification_confidence numeric
    check (classification_confidence is null or classification_confidence between 0 and 1),
  add column classification_source text
    check (classification_source is null or classification_source in ('BLOCK','AI','RULE','MANUAL')),
  add column classified_at timestamptz,
  add column classified_by uuid references auth.users(id),
  add column technical_attributes jsonb not null default '{}'::jsonb;

alter table public.price_list_imports
  add column system_id uuid references public.product_systems(id) on delete set null,
  add column category_id uuid references public.product_categories(id) on delete set null,
  add column subcategory_id uuid references public.product_subcategories(id) on delete set null,
  add column classification_mode text not null default 'BLOCK'
    check (classification_mode in ('BLOCK','AI')),
  add column column_mapping jsonb not null default '{}'::jsonb;

create table public.catalog_classification_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  match_type text not null check (match_type in ('REFERENCE_PREFIX','KEYWORD','BRAND_MODEL')),
  match_value text not null,
  system_id uuid references public.product_systems(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete cascade,
  subcategory_id uuid references public.product_subcategories(id) on delete cascade,
  confidence numeric not null default 0.95 check (confidence between 0 and 1),
  learned_from_product_id uuid references public.catalog_products(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, match_type, match_value)
);

create index product_systems_company_active_idx on public.product_systems(company_id, active, sort_order);
create index product_categories_system_active_idx on public.product_categories(system_id, active, sort_order);
create index product_subcategories_category_active_idx on public.product_subcategories(category_id, active, sort_order);
create index catalog_products_taxonomy_idx on public.catalog_products(company_id, system_id, category_id, subcategory_id);
create index catalog_products_pending_idx on public.catalog_products(company_id, classification_status)
  where classification_status in ('PENDING','REVIEW');
create index catalog_classification_rules_lookup_idx
  on public.catalog_classification_rules(company_id, match_type, match_value) where active;

alter table public.product_systems enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_subcategories enable row level security;
alter table public.catalog_classification_rules enable row level security;

create policy product_systems_company_access on public.product_systems for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=product_systems.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=product_systems.company_id and p.is_active));

create policy product_categories_company_access on public.product_categories for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=product_categories.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=product_categories.company_id and p.is_active));

create policy product_subcategories_company_access on public.product_subcategories for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=product_subcategories.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=product_subcategories.company_id and p.is_active));

create policy catalog_classification_rules_company_access on public.catalog_classification_rules for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=catalog_classification_rules.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=catalog_classification_rules.company_id and p.is_active));

grant select, insert, update, delete on public.product_systems to authenticated;
grant select, insert, update, delete on public.product_categories to authenticated;
grant select, insert, update, delete on public.product_subcategories to authenticated;
grant select, insert, update, delete on public.catalog_classification_rules to authenticated;

insert into public.product_systems(company_id, name, normalized_name, sort_order)
select c.id, seed.name, seed.normalized_name, seed.sort_order
from public.companies c
cross join (values
  ('Seguridad Electrónica','seguridad electronica',10),
  ('Redes de Voz y Datos','redes de voz y datos',20),
  ('Redes de Media y Baja Tensión','redes de media y baja tension',30),
  ('Redes de Fibra Óptica','redes de fibra optica',40)
) as seed(name, normalized_name, sort_order)
on conflict(company_id, normalized_name) do nothing;

insert into public.product_categories(company_id, system_id, name, normalized_name, sort_order)
select ps.company_id, ps.id, seed.name, seed.normalized_name, seed.sort_order
from public.product_systems ps
cross join (values
  ('CCTV','cctv',10),
  ('Control de Acceso','control de acceso',20),
  ('Detección de Incendio','deteccion de incendio',30),
  ('Audioevacuación','audioevacuacion',40),
  ('Alarmas de Intrusión','alarmas de intrusion',50)
) as seed(name, normalized_name, sort_order)
where ps.normalized_name='seguridad electronica'
on conflict(system_id, normalized_name) do nothing;

insert into public.product_subcategories(company_id, category_id, name, normalized_name, sort_order)
select pc.company_id, pc.id, seed.name, seed.normalized_name, seed.sort_order
from public.product_categories pc
cross join (values
  ('Accesorios','accesorios',10),
  ('Cámaras','camaras',20),
  ('NVR','nvr',30),
  ('Software','software',40)
) as seed(name, normalized_name, sort_order)
where pc.normalized_name='cctv'
on conflict(category_id, normalized_name) do nothing;

update public.catalog_products
set classification_status='PENDING'
where system_id is null;
