-- Personal sales history and expense entry. Existing unowned expenses stay admin-only.
begin;
alter table public.dib_expenses add column if not exists created_by uuid references auth.users(id);
alter table public.dib_expenses alter column created_by set default auth.uid();
create index if not exists dib_expenses_owner_date_idx on public.dib_expenses(created_by,date);
create index if not exists dib_sales_owner_date_idx on public.dib_sales(created_by,date);
alter policy sales_read on public.dib_sales using (
  (select public.dib_role()) = 'admin' or
  ((select public.dib_role()) = 'user' and created_by = (select auth.uid()))
);
create policy expenses_own_read on public.dib_expenses for select to authenticated
  using ((select public.dib_role()) = 'user' and created_by = (select auth.uid()));

create function public.dib_record_expense(p_id uuid, p_category text, p_note text, p_amount numeric, p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.dib_expenses;
begin
  if public.dib_role() is distinct from 'user' then raise exception 'User access required'; end if;
  if p_id is null or p_category is null or length(trim(p_category)) = 0 or p_date is null
    or p_amount is null or p_amount < 0 or p_amount::text in ('NaN','Infinity','-Infinity')
    then raise exception 'Invalid expense'; end if;
  insert into public.dib_expenses(id,category,note,amount,date,created_by)
    values(p_id,trim(p_category),coalesce(p_note,''),p_amount,p_date,auth.uid())
    on conflict(id) do nothing;
  select * into existing from public.dib_expenses where id=p_id;
  if existing.created_by is distinct from auth.uid() or existing.category <> trim(p_category)
    or existing.note <> coalesce(p_note,'') or existing.amount <> p_amount or existing.date <> p_date
    then raise exception 'Expense ID already exists'; end if;
  return p_id;
end;
$$;
revoke all on function public.dib_record_expense(uuid,text,text,numeric,date) from public,anon;
grant execute on function public.dib_record_expense(uuid,text,text,numeric,date) to authenticated;
commit;
