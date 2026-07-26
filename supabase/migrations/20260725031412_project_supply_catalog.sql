create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  internal_sku text,
  normalized_key text not null,
  name text not null,
  description text,
  category text,
  subcategory text,
  brand text,
  model text,
  unit text not null default 'UND',
  tax_percent numeric not null default 19 check (tax_percent between 0 and 100),
  item_type text not null default 'INSTALLABLE' check (item_type in ('CONSUMABLE','INSTALLABLE','TOOL','ASSET')),
  keywords text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, normalized_key),
  unique(company_id, internal_sku)
);

create table public.price_list_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  supplier_id uuid not null references public.suppliers(id),
  file_name text not null,
  status text not null default 'PROCESSING',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  error_rows integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  imported_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.supplier_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  import_id uuid references public.price_list_imports(id) on delete set null,
  supplier_sku text,
  unit_price numeric not null check (unit_price >= 0),
  currency text not null default 'COP',
  tax_included boolean not null default false,
  min_quantity numeric not null default 1,
  lead_time_days integer,
  valid_from date not null default current_date,
  valid_until date,
  source_file text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.project_material_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id),
  quantity_required numeric not null default 0 check (quantity_required >= 0),
  quantity_purchased numeric not null default 0 check (quantity_purchased >= 0),
  quantity_delivered numeric not null default 0 check (quantity_delivered >= 0),
  quantity_installed numeric not null default 0 check (quantity_installed >= 0),
  quantity_returned numeric not null default 0 check (quantity_returned >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, product_id)
);

alter table public.quotation_items
  add column if not exists product_id uuid references public.catalog_products(id),
  add column if not exists supplier_price_id uuid references public.supplier_prices(id),
  add column if not exists reference_cost numeric;

alter table public.purchase_order_items
  add column if not exists product_id uuid references public.catalog_products(id),
  add column if not exists delivery_destination text not null default 'PROJECT'
    check (delivery_destination in ('PROJECT','WAREHOUSE')),
  add column if not exists delivered_to_project_quantity numeric not null default 0,
  add column if not exists warehouse_quantity numeric not null default 0;

alter table public.inventory_items
  add column if not exists product_id uuid references public.catalog_products(id);
create unique index if not exists inventory_items_company_product_key
  on public.inventory_items(company_id, product_id) where product_id is not null;

create index idx_catalog_products_company_name on public.catalog_products(company_id, name);
create index idx_supplier_prices_product on public.supplier_prices(product_id, active, created_at desc);
create index idx_supplier_prices_supplier on public.supplier_prices(supplier_id, active);
create index idx_price_list_imports_company on public.price_list_imports(company_id, created_at desc);
create index idx_project_material_requirements_project on public.project_material_requirements(project_id);
create index idx_quotation_items_product on public.quotation_items(product_id);
create index idx_purchase_order_items_product on public.purchase_order_items(product_id);

alter table public.catalog_products enable row level security;
alter table public.price_list_imports enable row level security;
alter table public.supplier_prices enable row level security;
alter table public.project_material_requirements enable row level security;

create policy catalog_products_company_access on public.catalog_products for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=catalog_products.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=catalog_products.company_id and p.is_active));

create policy price_list_imports_company_access on public.price_list_imports for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=price_list_imports.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=price_list_imports.company_id and p.is_active));

create policy supplier_prices_company_access on public.supplier_prices for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=supplier_prices.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=supplier_prices.company_id and p.is_active));

create policy project_material_requirements_company_access on public.project_material_requirements for all to authenticated
using (exists(select 1 from public.projects pr join public.profiles p on p.company_id=pr.company_id where pr.id=project_material_requirements.project_id and p.id=(select auth.uid()) and p.is_active))
with check (exists(select 1 from public.projects pr join public.profiles p on p.company_id=pr.company_id where pr.id=project_material_requirements.project_id and p.id=(select auth.uid()) and p.is_active));

grant select, insert, update, delete on public.catalog_products to authenticated;
grant select, insert, update, delete on public.price_list_imports to authenticated;
grant select, insert, update, delete on public.supplier_prices to authenticated;
grant select, insert, update, delete on public.project_material_requirements to authenticated;
