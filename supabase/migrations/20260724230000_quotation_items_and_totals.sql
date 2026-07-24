alter table public.quotations
  add column if not exists subtotal numeric not null default 0,
  add column if not exists discount_total numeric not null default 0,
  add column if not exists tax_total numeric not null default 0,
  add column if not exists validity_date date,
  add column if not exists notes text;

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  description text not null,
  unit text not null default 'UND',
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  discount_percent numeric not null default 0 check (discount_percent between 0 and 100),
  tax_percent numeric not null default 0 check (tax_percent between 0 and 100),
  created_at timestamptz not null default now()
);

create index idx_quotation_items_quotation on public.quotation_items(quotation_id);
alter table public.quotation_items enable row level security;

create policy quotation_items_company_access on public.quotation_items for all to authenticated
using (exists (
  select 1 from public.quotations q
  join public.opportunities o on o.id=q.opportunity_id
  join public.clients c on c.id=o.client_id
  join public.profiles p on p.company_id=c.company_id
  where q.id=quotation_items.quotation_id and p.id=(select auth.uid()) and p.is_active
))
with check (exists (
  select 1 from public.quotations q
  join public.opportunities o on o.id=q.opportunity_id
  join public.clients c on c.id=o.client_id
  join public.profiles p on p.company_id=c.company_id
  where q.id=quotation_items.quotation_id and p.id=(select auth.uid()) and p.is_active
));
