alter table public.companies
  add column if not exists chamber_of_commerce text,
  add column if not exists chamber_registration_date date,
  add column if not exists chamber_renewal_date date,
  add column if not exists company_duration text,
  add column if not exists authorized_capital numeric not null default 0,
  add column if not exists subscribed_capital numeric not null default 0;
