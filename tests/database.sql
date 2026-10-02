-- Run in the existing project's SQL editor. All fixtures and changes roll back.
begin;
set local request.jwt.claim.sub = '11015dc6-dbfe-4277-9c9d-7264b7bd828d';
set local role authenticated;
select public.dib_save_stock('00000000-0000-4000-8000-000000000101', '{"brand":"QA","model":"ROLLBACK TEST","quantity":4,"buyingPrice":100,"transport":20,"sellingPrice":200,"date":"2026-09-21"}');
select public.dib_record_sale('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000101',1,200,current_date - 1);
do $$ begin
  if (select count(*) from public.dib_purchase_costs where stock_id='00000000-0000-4000-8000-000000000101') <> 1 then raise exception 'Admin cost read failed'; end if;
end $$;
set local request.jwt.claim.sub = '55f7eb18-9a45-48ff-8f32-7cd1f8b54659';
select public.dib_record_sale('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000101',1,200,(now() at time zone 'Africa/Dar_es_Salaam')::date);
select public.dib_record_sale('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000101',1,200,(now() at time zone 'Africa/Dar_es_Salaam')::date);
do $$ begin
  if (select sold from public.dib_stock where id='00000000-0000-4000-8000-000000000101') <> 2 then raise exception 'Sale retry duplicated stock movement'; end if;
  if exists(select 1 from public.dib_purchase_costs) then raise exception 'User can read costs'; end if;
  if exists(select 1 from public.dib_sales where date <> (now() at time zone 'Africa/Dar_es_Salaam')::date) then raise exception 'User can read historical sales'; end if;
  begin
    perform public.dib_record_sale(gen_random_uuid(),'00000000-0000-4000-8000-000000000101',99,200,(now() at time zone 'Africa/Dar_es_Salaam')::date);
    raise exception 'Oversell accepted' using errcode='ZX001';
  exception when raise_exception then null; end;
  begin
    perform public.dib_record_sale(gen_random_uuid(),'00000000-0000-4000-8000-000000000101',1,200,(now() at time zone 'Africa/Dar_es_Salaam')::date-1);
    raise exception 'User backdate accepted' using errcode='ZX002';
  exception when raise_exception then null; end;
  begin
    perform public.dib_save_stock(gen_random_uuid(),'{}');
    raise exception 'User purchase accepted' using errcode='ZX003';
  exception when raise_exception then null; end;
  begin
    insert into public.dib_expenses(category,amount,date) values('QA',1,current_date);
    raise exception 'User expense accepted' using errcode='ZX004';
  exception when insufficient_privilege then null; end;
end $$;
select public.dib_adjust_stock('00000000-0000-4000-8000-000000000101',3,2,'Rollback test physical count');
do $$ begin
  begin
    perform public.dib_adjust_stock('00000000-0000-4000-8000-000000000101',4,2,'Stale test');
    raise exception 'Stale adjustment accepted' using errcode='ZX005';
  exception when raise_exception then null; end;
  if (select quantity+adjustment-sold from public.dib_stock where id='00000000-0000-4000-8000-000000000101')<>3 then raise exception 'Adjustment failed'; end if;
end $$;
set local request.jwt.claim.sub = '11015dc6-dbfe-4277-9c9d-7264b7bd828d';
select public.dib_delete_sale('00000000-0000-4000-8000-000000000103');
select public.dib_delete_sale('00000000-0000-4000-8000-000000000103');
do $$ begin
  if (select sold from public.dib_stock where id='00000000-0000-4000-8000-000000000101')<>1 then raise exception 'Delete retry failed'; end if;
  begin
    perform public.dib_delete_stock('00000000-0000-4000-8000-000000000101');
    raise exception 'Stock history deleted' using errcode='ZX006';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.dib_expenses(category,amount,date) values('QA','NaN',current_date);
    raise exception 'NaN accepted' using errcode='ZX007';
  exception when check_violation then null; end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000199';
do $$ begin
  if exists(select 1 from public.dib_stock) then raise exception 'Unassigned account can read stock'; end if;
  begin
    perform public.dib_adjust_stock('00000000-0000-4000-8000-000000000101',1,4,'Denied');
    raise exception 'Unassigned adjustment accepted' using errcode='ZX008';
  exception when raise_exception then null; end;
end $$;
reset role;
update public.dib_members set active=false where id='55f7eb18-9a45-48ff-8f32-7cd1f8b54659';
set local role authenticated;
set local request.jwt.claim.sub = '55f7eb18-9a45-48ff-8f32-7cd1f8b54659';
do $$ begin
  if exists(select 1 from public.dib_stock) or public.dib_role() is not null then raise exception 'Inactive account allowed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.dib_stock;
    raise exception 'Anonymous read allowed' using errcode='ZX009';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: admin, user, inactive, unassigned, anonymous, retry, oversell, adjustment, validation; fixtures rolled back' as result;
