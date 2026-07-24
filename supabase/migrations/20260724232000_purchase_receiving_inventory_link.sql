alter table public.purchase_order_items
  add column if not exists inventory_item_id uuid references public.inventory_items(id),
  add column if not exists received_quantity numeric not null default 0 check (received_quantity >= 0);

create index if not exists idx_purchase_order_items_inventory_item
  on public.purchase_order_items(inventory_item_id);
