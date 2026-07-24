alter table public.employees add column base_salary numeric not null default 0;
create table public.employee_payment_items (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id) on delete cascade,
 code text not null, name text not null, base_amount numeric not null default 0, rate numeric not null default 0,
 calculation_type text not null default 'PERCENTAGE', fixed_amount numeric not null default 0,
 payment_method text not null default 'BANK_TRANSFER', beneficiary text, is_enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(employee_id,code)
);
create table public.employee_payments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 employee_id uuid not null references public.employees(id), payment_item_id uuid references public.employee_payment_items(id),
 payment_type text not null, period_start date, period_end date, base_amount numeric not null default 0,
 rate numeric not null default 0, amount numeric not null, payment_method text not null, status text not null default 'PENDING',
 paid_at timestamptz, reference text, notes text, created_at timestamptz not null default now()
);
create index idx_employee_payment_items_employee on public.employee_payment_items(employee_id);
create index idx_employee_payments_company on public.employee_payments(company_id);
create index idx_employee_payments_employee on public.employee_payments(employee_id);
create index idx_employee_payments_item on public.employee_payments(payment_item_id);
alter table public.employee_payment_items enable row level security;
alter table public.employee_payments enable row level security;
create policy employee_payment_items_company_access on public.employee_payment_items for all to authenticated
using (exists(select 1 from public.employees e join public.profiles p on p.company_id=e.company_id where e.id=employee_payment_items.employee_id and p.id=(select auth.uid()) and p.is_active))
with check (exists(select 1 from public.employees e join public.profiles p on p.company_id=e.company_id where e.id=employee_payment_items.employee_id and p.id=(select auth.uid()) and p.is_active));
create policy employee_payments_company_access on public.employee_payments for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=employee_payments.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=employee_payments.company_id and p.is_active));
