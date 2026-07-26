alter table public.companies
  add column if not exists chamber_last_renewed_year integer,
  add column if not exists niif_group text,
  add column if not exists corporate_purpose text,
  add column if not exists company_size text,
  add column if not exists ordinary_income numeric not null default 0,
  add column if not exists alternate_legal_representative text,
  add column if not exists alternate_representative_document text,
  add column if not exists control_situation text,
  add column if not exists authorized_shares numeric not null default 0,
  add column if not exists subscribed_shares numeric not null default 0,
  add column if not exists paid_shares numeric not null default 0,
  add column if not exists nominal_share_value numeric not null default 0;
