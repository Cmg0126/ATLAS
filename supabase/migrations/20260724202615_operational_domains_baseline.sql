-- Operational domains layered on top of CORE, CRM and PROJECTS.

create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  client_id uuid references public.clients(id),
  code text not null,
  title text not null,
  entity text,
  status text not null default 'DRAFT',
  submission_date date,
  estimated_value numeric not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);
create table public.tender_requirements (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  title text not null,
  responsible text,
  due_date date,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  nit text,
  email text,
  phone text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  supplier_id uuid references public.suppliers(id),
  project_id uuid references public.projects(id),
  order_number text not null,
  status text not null default 'DRAFT',
  issue_date date not null default current_date,
  expected_date date,
  total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, order_number)
);
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_cost numeric not null default 0,
  created_at timestamptz not null default now()
);
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  sku text not null,
  name text not null,
  category text,
  unit text not null default 'UND',
  current_stock numeric not null default 0,
  min_stock numeric not null default 0,
  unit_cost numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, sku)
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  item_id uuid not null references public.inventory_items(id),
  project_id uuid references public.projects(id),
  movement_type text not null,
  quantity numeric not null,
  reference text,
  notes text,
  movement_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  branch_id uuid references public.branches(id),
  employee_code text not null,
  full_name text not null,
  document_number text,
  email text,
  phone text,
  position text,
  department text,
  status text not null default 'ACTIVE',
  hire_date date,
  contract_type text not null default 'PAYROLL',
  contract_start_date date,
  contract_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, employee_code)
);
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_type text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'PENDING',
  notes text,
  created_at timestamptz not null default now()
);
create table public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  party_type text not null default 'COMPANY',
  name text not null,
  document_number text,
  contact_name text,
  email text,
  phone text,
  specialty text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.subcontractor_contracts (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  project_id uuid references public.projects(id),
  contract_number text not null,
  contract_type text not null default 'SUBCONTRACT',
  scope text not null,
  start_date date,
  end_date date,
  contract_value numeric not null default 0,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subcontractor_id, contract_number)
);

create table public.sst_incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  employee_id uuid references public.employees(id),
  project_id uuid references public.projects(id),
  incident_date date not null,
  incident_type text not null,
  severity text not null default 'LOW',
  status text not null default 'OPEN',
  description text not null,
  corrective_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sst_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  project_id uuid references public.projects(id),
  inspection_date date not null,
  inspection_type text not null,
  result text not null default 'PENDING',
  inspector text,
  findings text,
  created_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  invoice_number text not null,
  invoice_type text not null default 'SALE',
  status text not null default 'DRAFT',
  issue_date date not null default current_date,
  due_date date,
  total numeric not null default 0,
  paid_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, invoice_number)
);
create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  project_id uuid references public.projects(id),
  transaction_type text not null,
  category text,
  description text not null,
  amount numeric not null,
  transaction_date date not null default current_date,
  status text not null default 'POSTED',
  created_at timestamptz not null default now()
);
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  project_id uuid references public.projects(id),
  request_type text not null,
  prompt text not null,
  status text not null default 'DRAFT',
  output text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tenders_company on public.tenders(company_id);
create index idx_tenders_client on public.tenders(client_id);
create index idx_tender_requirements_tender on public.tender_requirements(tender_id);
create index idx_suppliers_company on public.suppliers(company_id);
create index idx_purchase_orders_company on public.purchase_orders(company_id);
create index idx_purchase_orders_supplier on public.purchase_orders(supplier_id);
create index idx_purchase_orders_project on public.purchase_orders(project_id);
create index idx_purchase_order_items_order on public.purchase_order_items(purchase_order_id);
create index idx_inventory_items_company on public.inventory_items(company_id);
create index idx_inventory_movements_company on public.inventory_movements(company_id);
create index idx_inventory_movements_item on public.inventory_movements(item_id);
create index idx_inventory_movements_project on public.inventory_movements(project_id);
create index idx_employees_company on public.employees(company_id);
create index idx_employees_branch on public.employees(branch_id);
create index idx_leave_requests_employee on public.leave_requests(employee_id);
create index idx_subcontractors_company on public.subcontractors(company_id);
create index idx_subcontractor_contracts_subcontractor on public.subcontractor_contracts(subcontractor_id);
create index idx_subcontractor_contracts_project on public.subcontractor_contracts(project_id);
create index idx_sst_incidents_company on public.sst_incidents(company_id);
create index idx_sst_incidents_employee on public.sst_incidents(employee_id);
create index idx_sst_incidents_project on public.sst_incidents(project_id);
create index idx_sst_inspections_company on public.sst_inspections(company_id);
create index idx_sst_inspections_project on public.sst_inspections(project_id);
create index idx_invoices_company on public.invoices(company_id);
create index idx_invoices_client on public.invoices(client_id);
create index idx_invoices_project on public.invoices(project_id);
create index idx_finance_transactions_company on public.finance_transactions(company_id);
create index idx_finance_transactions_project on public.finance_transactions(project_id);
create index idx_ai_requests_company on public.ai_requests(company_id);
create index idx_ai_requests_project on public.ai_requests(project_id);

alter table public.tenders enable row level security;
alter table public.tender_requirements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.employees enable row level security;
alter table public.leave_requests enable row level security;
alter table public.subcontractors enable row level security;
alter table public.subcontractor_contracts enable row level security;
alter table public.sst_incidents enable row level security;
alter table public.sst_inspections enable row level security;
alter table public.invoices enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.ai_requests enable row level security;

create policy tenders_company_access on public.tenders for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=tenders.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=tenders.company_id and p.is_active));
create policy tender_requirements_company_access on public.tender_requirements for all to authenticated
using (exists(select 1 from public.tenders t join public.profiles p on p.company_id=t.company_id where t.id=tender_requirements.tender_id and p.id=(select auth.uid()) and p.is_active))
with check (exists(select 1 from public.tenders t join public.profiles p on p.company_id=t.company_id where t.id=tender_requirements.tender_id and p.id=(select auth.uid()) and p.is_active));
create policy suppliers_company_access on public.suppliers for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=suppliers.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=suppliers.company_id and p.is_active));
create policy purchase_orders_company_access on public.purchase_orders for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=purchase_orders.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=purchase_orders.company_id and p.is_active));
create policy purchase_order_items_company_access on public.purchase_order_items for all to authenticated
using (exists(select 1 from public.purchase_orders o join public.profiles p on p.company_id=o.company_id where o.id=purchase_order_items.purchase_order_id and p.id=(select auth.uid()) and p.is_active))
with check (exists(select 1 from public.purchase_orders o join public.profiles p on p.company_id=o.company_id where o.id=purchase_order_items.purchase_order_id and p.id=(select auth.uid()) and p.is_active));
create policy inventory_items_company_access on public.inventory_items for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=inventory_items.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=inventory_items.company_id and p.is_active));
create policy inventory_movements_company_access on public.inventory_movements for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=inventory_movements.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=inventory_movements.company_id and p.is_active));
create policy employees_company_access on public.employees for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=employees.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=employees.company_id and p.is_active));
create policy leave_requests_company_access on public.leave_requests for all to authenticated
using (exists(select 1 from public.employees e join public.profiles p on p.company_id=e.company_id where e.id=leave_requests.employee_id and p.id=(select auth.uid()) and p.is_active))
with check (exists(select 1 from public.employees e join public.profiles p on p.company_id=e.company_id where e.id=leave_requests.employee_id and p.id=(select auth.uid()) and p.is_active));
create policy subcontractors_company_access on public.subcontractors for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=subcontractors.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=subcontractors.company_id and p.is_active));
create policy subcontractor_contracts_company_access on public.subcontractor_contracts for all to authenticated
using (exists(select 1 from public.subcontractors s join public.profiles p on p.company_id=s.company_id where s.id=subcontractor_contracts.subcontractor_id and p.id=(select auth.uid()) and p.is_active))
with check (exists(select 1 from public.subcontractors s join public.profiles p on p.company_id=s.company_id where s.id=subcontractor_contracts.subcontractor_id and p.id=(select auth.uid()) and p.is_active));
create policy sst_incidents_company_access on public.sst_incidents for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=sst_incidents.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=sst_incidents.company_id and p.is_active));
create policy sst_inspections_company_access on public.sst_inspections for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=sst_inspections.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=sst_inspections.company_id and p.is_active));
create policy invoices_company_access on public.invoices for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=invoices.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=invoices.company_id and p.is_active));
create policy finance_transactions_company_access on public.finance_transactions for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=finance_transactions.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=finance_transactions.company_id and p.is_active));
create policy ai_requests_company_access on public.ai_requests for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=ai_requests.company_id and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=ai_requests.company_id and p.is_active));
