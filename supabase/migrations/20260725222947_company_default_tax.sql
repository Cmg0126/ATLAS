alter table public.companies
  add column if not exists default_tax_percent numeric not null default 19
  check (default_tax_percent between 0 and 100);

update public.companies
set default_tax_percent = 19
where default_tax_percent is null;
