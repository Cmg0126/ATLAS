create sequence if not exists public.quotation_consecutive_seq
  as integer
  start with 78
  increment by 1
  minvalue 78;

alter table public.quotations
  add column if not exists quotation_consecutive integer,
  add column if not exists version smallint not null default 1;

alter table public.quotations
  drop constraint if exists quotations_version_positive;

alter table public.quotations
  add constraint quotations_version_positive check (version > 0);

create or replace function public.assign_quotation_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.quotation_consecutive is null then
    new.quotation_consecutive := nextval('public.quotation_consecutive_seq');
  end if;

  if new.version is null then
    new.version := 1;
  end if;

  new.quotation_number := format(
    'COT-%s-%sV%s',
    new.quotation_consecutive,
    to_char(coalesce(new.created_at, now()), 'YY'),
    new.version
  );

  return new;
end;
$$;

drop trigger if exists quotations_assign_number on public.quotations;
create trigger quotations_assign_number
before insert or update of quotation_consecutive, version
on public.quotations
for each row
execute function public.assign_quotation_number();
create sequence if not exists public.quotation_consecutive_seq
  as integer
  start with 78
  increment by 1
  minvalue 78;

alter table public.quotations
  add column if not exists quotation_consecutive integer,
  add column if not exists version smallint not null default 1;

alter table public.quotations
  drop constraint if exists quotations_version_positive;

alter table public.quotations
  add constraint quotations_version_positive check (version > 0);

create or replace function public.assign_quotation_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.quotation_consecutive is null then
    new.quotation_consecutive := nextval('public.quotation_consecutive_seq');
  end if;

  if new.version is null then
    new.version := 1;
  end if;

  new.quotation_number := format(
    'COT-%s-%sV%s',
    new.quotation_consecutive,
    to_char(coalesce(new.created_at, now()), 'YY'),
    new.version
  );

  return new;
end;
$$;

drop trigger if exists quotations_assign_number on public.quotations;
create trigger quotations_assign_number
before insert or update of quotation_consecutive, version
on public.quotations
for each row
execute function public.assign_quotation_number();
