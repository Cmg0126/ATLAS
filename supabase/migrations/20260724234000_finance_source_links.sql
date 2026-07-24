alter table public.finance_transactions
  add column if not exists invoice_id uuid references public.invoices(id),
  add column if not exists employee_payment_id uuid references public.employee_payments(id);

create unique index if not exists uq_finance_transaction_employee_payment
  on public.finance_transactions(employee_payment_id) where employee_payment_id is not null;
create index if not exists idx_finance_transactions_invoice
  on public.finance_transactions(invoice_id);
