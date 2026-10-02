-- DIB Stock Control: run once in the Supabase SQL editor.
-- No business data or accounts are imported by this migration.
begin;

create table public.dib_members (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null check (role in ('admin', 'user')),
  active boolean not null default true
);

create function public.dib_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.dib_members where id = auth.uid() and active;
$$;
revoke all on function public.dib_role() from public, anon;
grant execute on function public.dib_role() to authenticated;

create table public.dib_stock (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null check (length(trim(model)) > 0),
  screen text not null default '',
  processor text not null default '',
  ram text not null default '',
  storage text not null default '',
  quantity integer not null check (quantity > 0),
  sold integer not null default 0 check (sold >= 0),
  adjustment integer not null default 0,
  selling_price numeric(16,2) not null check (selling_price >= 0),
  date date not null,
  check (quantity::bigint + adjustment - sold >= 0)
);

-- Purchase costs are stored separately so a User cannot retrieve them.
create table public.dib_purchase_costs (
  stock_id uuid primary key references public.dib_stock(id) on delete cascade,
  buying_price numeric(16,2) not null check (buying_price >= 0),
  transport numeric(16,2) not null default 0 check (transport >= 0)
);

create table public.dib_sales (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.dib_stock(id),
  model text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(16,2) not null check (unit_price >= 0),
  date date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index dib_sales_date_idx on public.dib_sales(date);
create index dib_sales_stock_idx on public.dib_sales(stock_id);

create table public.dib_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (length(trim(category)) > 0),
  note text not null default '',
  amount numeric(16,2) not null check (amount >= 0),
  date date not null
);
create table public.dib_revenue (
  id uuid primary key default gen_random_uuid(),
  source text not null check (length(trim(source)) > 0),
  note text not null default '',
  amount numeric(16,2) not null check (amount > 0),
  date date not null
);
create table public.dib_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.dib_stock(id),
  previous_remaining integer not null,
  new_remaining integer not null check (new_remaining >= 0),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.dib_members enable row level security;
alter table public.dib_stock enable row level security;
alter table public.dib_purchase_costs enable row level security;
alter table public.dib_sales enable row level security;
alter table public.dib_expenses enable row level security;
alter table public.dib_revenue enable row level security;
alter table public.dib_stock_adjustments enable row level security;

-- Remove Supabase's default table grants. Writes to stock/sales use RPCs.
revoke all on public.dib_members, public.dib_stock, public.dib_purchase_costs,
  public.dib_sales, public.dib_expenses, public.dib_revenue,
  public.dib_stock_adjustments from anon, authenticated;
grant select on public.dib_members, public.dib_stock, public.dib_purchase_costs,
  public.dib_sales, public.dib_stock_adjustments to authenticated;
grant select, insert, update, delete on public.dib_expenses, public.dib_revenue to authenticated;

-- Membership is assigned by the project owner, never by signup metadata.
create policy member_read on public.dib_members for select to authenticated
  using (id = auth.uid() or (select public.dib_role()) = 'admin');
create policy stock_read on public.dib_stock for select to authenticated
  using ((select public.dib_role()) in ('admin', 'user'));
create policy costs_admin on public.dib_purchase_costs for select to authenticated
  using ((select public.dib_role()) = 'admin');
create policy sales_read on public.dib_sales for select to authenticated
  using ((select public.dib_role()) = 'admin' or
    ((select public.dib_role()) = 'user' and date = (now() at time zone 'Africa/Dar_es_Salaam')::date));
create policy expenses_admin on public.dib_expenses for all to authenticated
  using ((select public.dib_role()) = 'admin') with check ((select public.dib_role()) = 'admin');
create policy revenue_admin on public.dib_revenue for all to authenticated
  using ((select public.dib_role()) = 'admin') with check ((select public.dib_role()) = 'admin');
create policy adjustments_admin on public.dib_stock_adjustments for select to authenticated
  using ((select public.dib_role()) = 'admin');

create function public.dib_record_sale(p_id uuid, p_stock_id uuid, p_quantity integer,
  p_unit_price numeric, p_date date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare item public.dib_stock; existing public.dib_sales; caller_role text := public.dib_role();
begin
  if caller_role is null or caller_role not in ('admin','user') then raise exception 'Access denied'; end if;
  if p_id is null or p_quantity is null or p_quantity <= 0 or p_unit_price is null or p_unit_price < 0
    or p_unit_price::text in ('NaN','Infinity','-Infinity') or p_date is null then raise exception 'Invalid sale'; end if;
  if caller_role = 'user' and p_date <> (now() at time zone 'Africa/Dar_es_Salaam')::date then
    raise exception 'Users may only enter sales for today';
  end if;
  select * into item from public.dib_stock where id = p_stock_id for update;
  if not found then raise exception 'Stock item not found'; end if;
  -- A retry with the same sale ID must not reduce stock twice.
  select * into existing from public.dib_sales where id = p_id;
  if found then
    if existing.stock_id = p_stock_id and existing.quantity = p_quantity
      and existing.unit_price = p_unit_price and existing.date = p_date
      and existing.created_by = auth.uid() then return existing.id; end if;
    raise exception 'Sale ID already exists';
  end if;
  if p_quantity > item.quantity::bigint + item.adjustment - item.sold then raise exception 'Not enough stock'; end if;
  insert into public.dib_sales(id,stock_id,model,quantity,unit_price,date,created_by)
    values(p_id,item.id,item.model,p_quantity,p_unit_price,p_date,auth.uid());
  update public.dib_stock set sold = sold + p_quantity where id = item.id;
  return p_id;
end;
$$;

create function public.dib_adjust_stock(p_stock_id uuid, p_remaining integer,
  p_expected_remaining integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.dib_stock; remaining integer;
begin
  if coalesce(public.dib_role(), '') not in ('admin','user') then raise exception 'Access denied'; end if;
  if p_remaining is null or p_remaining < 0 or p_expected_remaining is null
    or p_reason is null or length(trim(p_reason)) = 0 then raise exception 'Enter a quantity and reason'; end if;
  select * into item from public.dib_stock where id = p_stock_id for update;
  if not found then raise exception 'Stock item not found'; end if;
  remaining := item.quantity + item.adjustment - item.sold;
  if remaining <> p_expected_remaining then raise exception 'Stock changed. Refresh before adjusting it.'; end if;
  insert into public.dib_stock_adjustments(stock_id,previous_remaining,new_remaining,reason,created_by)
    values(item.id,remaining,p_remaining,trim(p_reason),auth.uid());
  update public.dib_stock set adjustment = adjustment + p_remaining - remaining where id = item.id;
end;
$$;

create function public.dib_save_stock(p_id uuid, p_item jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare item_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if public.dib_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
  insert into public.dib_stock(id,brand,model,screen,processor,ram,storage,quantity,selling_price,date)
  values(item_id,p_item->>'brand',p_item->>'model',coalesce(p_item->>'screen',''),
    coalesce(p_item->>'processor',''),coalesce(p_item->>'ram',''),coalesce(p_item->>'storage',''),
    (p_item->>'quantity')::integer,(p_item->>'sellingPrice')::numeric,(p_item->>'date')::date)
  on conflict (id) do update set brand=excluded.brand,model=excluded.model,screen=excluded.screen,
    processor=excluded.processor,ram=excluded.ram,storage=excluded.storage,quantity=excluded.quantity,
    selling_price=excluded.selling_price,date=excluded.date;
  insert into public.dib_purchase_costs(stock_id,buying_price,transport)
    values(item_id,(p_item->>'buyingPrice')::numeric,(p_item->>'transport')::numeric)
    on conflict(stock_id) do update set buying_price=excluded.buying_price,transport=excluded.transport;
  return item_id;
end;
$$;

create function public.dib_delete_sale(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare sale public.dib_sales;
begin
  if public.dib_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
  select * into sale from public.dib_sales where id=p_id;
  if not found then return; end if;
  perform 1 from public.dib_stock where id=sale.stock_id for update;
  delete from public.dib_sales where id=p_id returning * into sale;
  if found then update public.dib_stock set sold=sold-sale.quantity where id=sale.stock_id; end if;
end;
$$;

-- Keep sold items and adjustment history; only unused entries can be removed.
create function public.dib_delete_stock(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.dib_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
  delete from public.dib_stock where id=p_id;
end;
$$;

revoke all on function public.dib_record_sale(uuid,uuid,integer,numeric,date),
  public.dib_adjust_stock(uuid,integer,integer,text),public.dib_save_stock(uuid,jsonb),
  public.dib_delete_sale(uuid),public.dib_delete_stock(uuid) from public, anon;
grant execute on function public.dib_record_sale(uuid,uuid,integer,numeric,date),
  public.dib_adjust_stock(uuid,integer,integer,text),public.dib_save_stock(uuid,jsonb),
  public.dib_delete_sale(uuid),public.dib_delete_stock(uuid) to authenticated;
commit;
