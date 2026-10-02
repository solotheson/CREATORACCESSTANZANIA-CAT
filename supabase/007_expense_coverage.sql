-- Coverage identifies funding sources for an already-paid expense. No cash is moved.
begin;
create table public.dib_expense_coverage (
  expense_id uuid primary key references public.dib_expenses(id) on delete cascade,
  profit numeric(16,2) not null default 0 check(profit >= 0 and profit <> 'NaN'::numeric),
  stock_capital numeric(16,2) not null default 0 check(stock_capital >= 0 and stock_capital <> 'NaN'::numeric),
  other_income numeric(16,2) not null default 0 check(other_income >= 0 and other_income <> 'NaN'::numeric),
  owner_capital numeric(16,2) not null default 0 check(owner_capital >= 0 and owner_capital <> 'NaN'::numeric),
  borrowed numeric(16,2) not null default 0 check(borrowed >= 0 and borrowed <> 'NaN'::numeric),
  revision integer not null default 1,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.dib_expense_coverage enable row level security;
revoke all on public.dib_expense_coverage from anon, authenticated;
grant select on public.dib_expense_coverage to authenticated;
create policy coverage_admin_read on public.dib_expense_coverage for select to authenticated
  using ((select public.dib_role())='admin');

create function public.dib_set_expense_coverage(p_expense_id uuid,p_expected_revision integer,p_expected_amount numeric,p_values jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
  expense_amount numeric; old public.dib_expense_coverage;
  v_profit numeric; v_stock numeric; v_other numeric; v_owner numeric; v_borrowed numeric;
  sales_total numeric; cost_total numeric; used_profit numeric; used_stock numeric;
begin
  if public.dib_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
  -- Serialize coverage allocation across all expenses to avoid assigning receipts twice.
  perform pg_catalog.pg_advisory_xact_lock(70707007);
  select amount into expense_amount from public.dib_expenses where id=p_expense_id for update;
  if not found then raise exception 'Expense no longer exists'; end if;
  if expense_amount is distinct from p_expected_amount then raise exception 'Expense changed. Refresh and reopen coverage.'; end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Invalid coverage'; end if;
  v_profit:=(p_values->>'profit')::numeric; v_stock:=(p_values->>'stock_capital')::numeric;
  v_other:=(p_values->>'other_income')::numeric; v_owner:=(p_values->>'owner_capital')::numeric;
  v_borrowed:=(p_values->>'borrowed')::numeric;
  if exists(select 1 from unnest(array[v_profit,v_stock,v_other,v_owner,v_borrowed]) n
    where n is null or n<0 or n>=1e14 or n::text in ('NaN','Infinity','-Infinity') or n<>round(n,2))
    then raise exception 'Coverage amounts must be nonnegative amounts with at most two decimals'; end if;
  if v_profit+v_stock+v_other+v_owner+v_borrowed>expense_amount then raise exception 'Coverage exceeds expense amount'; end if;
  select * into old from public.dib_expense_coverage where expense_id=p_expense_id;
  -- Exact retries succeed after an ambiguous network response; stale edits cannot overwrite.
  if old.expense_id is not null and old.profit=v_profit and old.stock_capital=v_stock
    and old.other_income=v_other and old.owner_capital=v_owner and old.borrowed=v_borrowed then return; end if;
  if coalesce(old.revision,0) is distinct from p_expected_revision then raise exception 'Coverage changed. Refresh and reopen it.'; end if;
  if exists(select 1 from public.dib_sales s left join public.dib_purchase_costs c on c.stock_id=s.stock_id where c.stock_id is null)
    then raise exception 'Missing purchase costs. Restore them before assigning sales funds.'; end if;
  select coalesce(sum(s.quantity*s.unit_price),0),coalesce(sum(s.quantity*(c.buying_price+c.transport/st.quantity)),0)
    into sales_total,cost_total from public.dib_sales s join public.dib_stock st on st.id=s.stock_id
    join public.dib_purchase_costs c on c.stock_id=s.stock_id;
  select coalesce(sum(profit),0),coalesce(sum(stock_capital),0) into used_profit,used_stock
    from public.dib_expense_coverage where expense_id<>p_expense_id;
  if used_profit+v_profit>round(greatest(0,sales_total-cost_total),2)
    or used_stock+v_stock>sales_total-round(greatest(0,sales_total-cost_total),2) then
    raise exception 'Not enough unassigned sales profit or recovered stock capital. Refresh and review coverage.';
  end if;
  insert into public.dib_expense_coverage(expense_id,profit,stock_capital,other_income,owner_capital,borrowed,revision,updated_by)
    values(p_expense_id,v_profit,v_stock,v_other,v_owner,v_borrowed,1,auth.uid())
    on conflict(expense_id) do update set profit=v_profit,stock_capital=v_stock,other_income=v_other,
      owner_capital=v_owner,borrowed=v_borrowed,revision=public.dib_expense_coverage.revision+1,updated_by=auth.uid(),updated_at=now();
end;
$$;
revoke all on function public.dib_set_expense_coverage(uuid,integer,numeric,jsonb) from public,anon;
grant execute on function public.dib_set_expense_coverage(uuid,integer,numeric,jsonb) to authenticated;
commit;
