drop trigger if exists quotations_assign_number on public.quotations;
drop sequence if exists public.quotation_consecutive_seq;

alter table public.quotations
  add column if not exists quotation_year smallint,
  add column if not exists revision_of uuid references public.quotations(id) on delete restrict;

alter table public.quotations
  alter column version drop default;

alter table public.quotations
  drop constraint if exists quotations_year_valid;
alter table public.quotations
  add constraint quotations_year_valid check (quotation_year between 2000 and 9999);

create unique index if not exists quotations_year_consecutive_version_key
  on public.quotations (quotation_year, quotation_consecutive, version);
create index if not exists idx_quotations_revision_of
  on public.quotations (revision_of)
  where revision_of is not null;

create or replace function public.assign_quotation_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  base_quote public.quotations%rowtype;
  calculated_year integer;
begin
  calculated_year := coalesce(
    new.quotation_year,
    extract(year from coalesce(new.created_at, now()))::integer
  );
  new.quotation_year := calculated_year;

  if new.revision_of is not null then
    select * into base_quote
    from public.quotations
    where id = new.revision_of;

    if not found then
      raise exception 'La cotización base no existe.';
    end if;

    new.quotation_year := base_quote.quotation_year;
    new.quotation_consecutive := base_quote.quotation_consecutive;

    perform pg_advisory_xact_lock(
      hashtextextended(
        format('quotation-version-%s-%s', new.quotation_year, new.quotation_consecutive),
        0
      )
    );

    select coalesce(max(q.version), 0) + 1
      into new.version
    from public.quotations q
    where q.quotation_year = new.quotation_year
      and q.quotation_consecutive = new.quotation_consecutive;
  else
    perform pg_advisory_xact_lock(
      hashtextextended(format('quotation-consecutive-%s', new.quotation_year), 0)
    );

    select case
      when new.quotation_year = 2026
        then greatest(78, coalesce(max(q.quotation_consecutive) + 1, 78))
      else coalesce(max(q.quotation_consecutive) + 1, 1)
    end
      into new.quotation_consecutive
    from public.quotations q
    where q.quotation_year = new.quotation_year;

    new.version := 1;
  end if;

  new.quotation_number := format(
    'COT-%s-%s%s',
    new.quotation_consecutive,
    lpad((new.quotation_year % 100)::text, 2, '0'),
    new.version
  );

  return new;
end;
$$;

create trigger quotations_assign_number
before insert on public.quotations
for each row
execute function public.assign_quotation_number();
drop trigger if exists quotations_assign_number on public.quotations;
drop sequence if exists public.quotation_consecutive_seq;

alter table public.quotations
  add column if not exists quotation_year smallint,
  add column if not exists revision_of uuid references public.quotations(id) on delete restrict;

alter table public.quotations
  alter column version drop default;

alter table public.quotations
  drop constraint if exists quotations_year_valid;
alter table public.quotations
  add constraint quotations_year_valid check (quotation_year between 2000 and 9999);

create unique index if not exists quotations_year_consecutive_version_key
  on public.quotations (quotation_year, quotation_consecutive, version);
create index if not exists idx_quotations_revision_of
  on public.quotations (revision_of)
  where revision_of is not null;

create or replace function public.assign_quotation_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  base_quote public.quotations%rowtype;
  calculated_year integer;
begin
  calculated_year := coalesce(
    new.quotation_year,
    extract(year from coalesce(new.created_at, now()))::integer
  );
  new.quotation_year := calculated_year;

  if new.revision_of is not null then
    select * into base_quote
    from public.quotations
    where id = new.revision_of;

    if not found then
      raise exception 'La cotización base no existe.';
    end if;

    new.quotation_year := base_quote.quotation_year;
    new.quotation_consecutive := base_quote.quotation_consecutive;

    perform pg_advisory_xact_lock(
      hashtextextended(
        format('quotation-version-%s-%s', new.quotation_year, new.quotation_consecutive),
        0
      )
    );

    select coalesce(max(q.version), 0) + 1
      into new.version
    from public.quotations q
    where q.quotation_year = new.quotation_year
      and q.quotation_consecutive = new.quotation_consecutive;
  else
    perform pg_advisory_xact_lock(
      hashtextextended(format('quotation-consecutive-%s', new.quotation_year), 0)
    );

    select case
      when new.quotation_year = 2026
        then greatest(78, coalesce(max(q.quotation_consecutive) + 1, 78))
      else coalesce(max(q.quotation_consecutive) + 1, 1)
    end
      into new.quotation_consecutive
    from public.quotations q
    where q.quotation_year = new.quotation_year;

    new.version := 1;
  end if;

  new.quotation_number := format(
    'COT-%s-%s%s',
    new.quotation_consecutive,
    lpad((new.quotation_year % 100)::text, 2, '0'),
    new.version
  );

  return new;
end;
$$;

create trigger quotations_assign_number
before insert on public.quotations
for each row
execute function public.assign_quotation_number();
