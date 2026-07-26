create table public.apu_resources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type text not null check (resource_type in ('MATERIAL','LABOR','EQUIPMENT')),
  catalog_product_id uuid references public.catalog_products(id) on delete set null,
  code text,
  description text not null,
  unit text not null default 'UND',
  default_unit_cost numeric not null default 0 check (default_unit_cost >= 0),
  identity_key text generated always as (
    lower(coalesce(nullif(btrim(code), ''), btrim(description)))
  ) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, resource_type, identity_key)
);

create index apu_resources_company_type_active_idx
  on public.apu_resources(company_id, resource_type, active, description);

alter table public.apu_items
  add column resource_id uuid references public.apu_resources(id) on delete set null;

insert into public.apu_resources (
  company_id,
  resource_type,
  catalog_product_id,
  code,
  description,
  unit,
  default_unit_cost
)
select distinct on (
  company_id,
  item_type,
  lower(coalesce(nullif(btrim(code), ''), btrim(description)))
)
  company_id,
  item_type,
  catalog_product_id,
  nullif(btrim(code), ''),
  description,
  unit,
  unit_cost
from public.apu_items
where item_type in ('MATERIAL','LABOR','EQUIPMENT')
order by
  company_id,
  item_type,
  lower(coalesce(nullif(btrim(code), ''), btrim(description))),
  updated_at desc;

update public.apu_items item
set resource_id = resource.id
from public.apu_resources resource
where resource.company_id = item.company_id
  and resource.resource_type = item.item_type
  and resource.identity_key =
    lower(coalesce(nullif(btrim(item.code), ''), btrim(item.description)));

alter table public.apu_resources enable row level security;

create policy apu_resources_company_access on public.apu_resources
for all to authenticated
using (exists (
  select 1
  from public.profiles profile
  where profile.id = (select auth.uid())
    and profile.company_id = apu_resources.company_id
    and profile.is_active
))
with check (exists (
  select 1
  from public.profiles profile
  where profile.id = (select auth.uid())
    and profile.company_id = apu_resources.company_id
    and profile.is_active
));

grant select, insert, update, delete on public.apu_resources to authenticated;
