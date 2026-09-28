-- Run after migration 005. Test fixtures are rolled back.
begin;
insert into public.dib_stock(id,brand,model,quantity,selling_price,date)
values('00000000-0000-4000-8000-000000000501','QA','Personal access test',10,100,current_date);
insert into public.dib_sales(id,stock_id,model,quantity,unit_price,date,created_by) values
('00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000501','QA',1,100,current_date-7,'55f7eb18-9a45-48ff-8f32-7cd1f8b54659'),
('00000000-0000-4000-8000-000000000503','00000000-0000-4000-8000-000000000501','QA',1,100,current_date,'11015dc6-dbfe-4277-9c9d-7264b7bd828d');
insert into public.dib_expenses(id,category,amount,date,created_by) values
('00000000-0000-4000-8000-000000000504','QA admin',20,current_date,'11015dc6-dbfe-4277-9c9d-7264b7bd828d'),
('00000000-0000-4000-8000-000000000505','QA legacy',20,current_date,null);
set local request.jwt.claim.sub='55f7eb18-9a45-48ff-8f32-7cd1f8b54659';
set local role authenticated;
select public.dib_record_expense('00000000-0000-4000-8000-000000000506','QA personal','Retry test',10,current_date);
select public.dib_record_expense('00000000-0000-4000-8000-000000000506','QA personal','Retry test',10,current_date);
do $$ begin
  if not exists(select 1 from public.dib_sales where id='00000000-0000-4000-8000-000000000502') then raise exception 'Own historical sale missing'; end if;
  if exists(select 1 from public.dib_sales where created_by is distinct from auth.uid()) then raise exception 'Other sales exposed'; end if;
  if exists(select 1 from public.dib_expenses where created_by is distinct from auth.uid()) then raise exception 'Other expenses exposed'; end if;
  if (select count(*) from public.dib_expenses where id='00000000-0000-4000-8000-000000000506')<>1 then raise exception 'Expense retry failed'; end if;
  begin
    perform public.dib_record_expense('00000000-0000-4000-8000-000000000504','QA admin','',20,current_date);
    raise exception 'Other owner expense overwritten' using errcode='ZX001';
  exception when raise_exception then null; end;
  begin
    perform public.dib_record_expense(gen_random_uuid(),'Bad','','NaN',current_date);
    raise exception 'NaN accepted' using errcode='ZX002';
  exception when raise_exception then null; end;
  if exists(select 1 from public.dib_purchase_costs) then raise exception 'Purchase costs exposed'; end if;
end $$;
set local request.jwt.claim.sub='11015dc6-dbfe-4277-9c9d-7264b7bd828d';
do $$ begin
  if (select count(*) from public.dib_expenses where id in ('00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000505','00000000-0000-4000-8000-000000000506'))<>3 then raise exception 'Admin expense access failed'; end if;
end $$;
reset role;
rollback;
select 'PASS: personal ownership, history, expense retry, validation, admin access' as result;
