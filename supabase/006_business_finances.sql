-- Apply before publishing the finance frontend. No existing entries are changed.
begin;
create table public.dib_funding (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('contribution','withdrawal','loan_received','loan_repayment')),
  amount numeric(16,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  note text not null default '' check (length(note) <= 500),
  date date not null,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.dib_funding enable row level security;
revoke all on public.dib_funding from anon, authenticated;
grant select, insert, update, delete on public.dib_funding to authenticated;
create policy funding_admin on public.dib_funding for all to authenticated
  using ((select public.dib_role()) = 'admin')
  with check ((select public.dib_role()) = 'admin');
create index dib_funding_date_idx on public.dib_funding(date);
commit;
