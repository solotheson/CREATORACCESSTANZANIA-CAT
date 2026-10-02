-- Apply after 001_initial.sql. Existing valid records are preserved.
begin;
alter table public.dib_stock add constraint dib_stock_finite_price check (selling_price <> 'NaN'::numeric);
alter table public.dib_stock add constraint dib_stock_brand_required check (length(trim(brand)) > 0);
alter table public.dib_purchase_costs add constraint dib_costs_finite check (buying_price <> 'NaN'::numeric and transport <> 'NaN'::numeric);
alter table public.dib_sales add constraint dib_sales_finite_price check (unit_price <> 'NaN'::numeric);
alter table public.dib_expenses add constraint dib_expenses_finite_amount check (amount <> 'NaN'::numeric);
alter table public.dib_revenue add constraint dib_revenue_finite_amount check (amount <> 'NaN'::numeric);
create index dib_adjustments_stock_idx on public.dib_stock_adjustments(stock_id);
commit;
