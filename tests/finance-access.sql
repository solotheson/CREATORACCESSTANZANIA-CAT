rollback;
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.dib_members where role='admin' and active limit 1),true);
select set_config('dib.qa_expense',gen_random_uuid()::text,true),set_config('dib.qa_fund',gen_random_uuid()::text,true);
set local role authenticated;
insert into public.dib_funding(id,type,amount,date,note) values(current_setting('dib.qa_fund')::uuid,'contribution',1,current_date,'Migration rollback test');
insert into public.dib_expenses(id,category,amount,date,created_by) values(current_setting('dib.qa_expense')::uuid,'Migration rollback test',1,current_date,auth.uid());
select public.dib_set_expense_coverage(current_setting('dib.qa_expense')::uuid,0,1,'{"profit":0,"stock_capital":0,"other_income":1,"owner_capital":0,"borrowed":0}');
select public.dib_set_expense_coverage(current_setting('dib.qa_expense')::uuid,0,1,'{"profit":0,"stock_capital":0,"other_income":1,"owner_capital":0,"borrowed":0}');
do $$ begin
 if (select revision from public.dib_expense_coverage where expense_id=current_setting('dib.qa_expense')::uuid)<>1 then raise exception 'Retry changed revision'; end if;
 if not exists(select 1 from public.dib_funding where id=current_setting('dib.qa_fund')::uuid) then raise exception 'Admin funding unavailable'; end if;
 begin
 perform public.dib_set_expense_coverage(current_setting('dib.qa_expense')::uuid,0,1,'{"profit":0,"stock_capital":0,"other_income":0,"owner_capital":1,"borrowed":0}');
 raise exception 'Stale revision accepted' using errcode='ZX001';
 exception when raise_exception then if sqlerrm not like 'Coverage changed.%' then raise; end if; end;
 begin
 perform public.dib_set_expense_coverage(current_setting('dib.qa_expense')::uuid,1,1,'{"profit":0,"stock_capital":0,"other_income":2,"owner_capital":0,"borrowed":0}');
 raise exception 'Overcoverage accepted' using errcode='ZX001';
 exception when raise_exception then if sqlerrm<>'Coverage exceeds expense amount' then raise; end if; end;
 begin
 perform public.dib_set_expense_coverage(current_setting('dib.qa_expense')::uuid,1,1,'{"profit":-1,"stock_capital":0,"other_income":0,"owner_capital":0,"borrowed":0}');
 raise exception 'Negative coverage accepted' using errcode='ZX001';
 exception when raise_exception then if sqlerrm not like 'Coverage amounts must%' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.dib_members where role='user' and active limit 1),true);
set local role authenticated;
do $$ begin
 if public.dib_role() is distinct from 'user' then raise exception 'Staff fixture missing'; end if;
 if exists(select 1 from public.dib_funding) or exists(select 1 from public.dib_expense_coverage) then raise exception 'Staff can read private finance data'; end if;
 begin
 insert into public.dib_funding(type,amount,date) values('contribution',1,current_date);
 raise exception 'Staff funding write accepted' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
 begin
 perform public.dib_set_expense_coverage(current_setting('dib.qa_expense')::uuid,1,1,'{}');
 raise exception 'Staff coverage accepted' using errcode='ZX001';
 exception when raise_exception then if sqlerrm<>'Admin access required' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.dib_funding','SELECT') or has_table_privilege('anon','public.dib_expense_coverage','SELECT') or has_function_privilege('anon','public.dib_set_expense_coverage(uuid,integer,numeric,jsonb)','EXECUTE') then raise exception 'Anonymous access granted'; end if;
 if has_table_privilege('authenticated','public.dib_expense_coverage','INSERT') or has_table_privilege('authenticated','public.dib_expense_coverage','UPDATE') then raise exception 'Direct coverage writes granted'; end if;
 if (select count(*) from pg_class where oid in ('public.dib_funding'::regclass,'public.dib_expense_coverage'::regclass) and relrowsecurity)<>2 then raise exception 'RLS missing'; end if;
end $$;
rollback;
select 'PASS: admin saves, exact retry, stale edit, amount validation, staff denial, anonymous denial, RLS; test records rolled back' as result;