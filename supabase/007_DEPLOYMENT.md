# Manual expense coverage

Prepared locally; migration and database permission checks have not been run on Supabase.

Apply `007_expense_coverage.sql` after migrations 001–006, then publish the frontend. Until applied, the existing app works with coverage marked unavailable. Existing expenses retain their original amount and are initially unassigned; no funding source is inferred.

Admins open **Expenses → Coverage** on an individual expense, enter the amount from each source, and save. Sources are sales profit, recovered stock capital, other income, owner capital and borrowing. Partial assignments are allowed. The remaining amount is **source not recorded**, not an unpaid bill: all expense records remain treated as already paid. Coverage neither creates capital/loan/income records nor deducts a second payment. Keep the corresponding funding and other-income records complete.

The Expenses page shows each expense's assigned amount and source breakdown, plus totals of sources used, sales profit left, recovered stock capital left and sales receipts left after allocations. These are pooled all-time sales figures, not per-item tracing, historical-date balances, bank balances or cash after restocking/withdrawals/loan repayments. Actual combined cash remains in **Business position**. Sources chosen are the Admin's declared attribution, not independently verified bank transfers.

Sales profit available for allocation is max(sales receipts − sold inventory cost, 0). Recovered capital is min(sales receipts, sold inventory cost), so loss-making sales never create fictitious recovered cash. Purchase transport is included in sold inventory cost. Remaining sales receipts = sales receipts − expense amounts assigned to sales profit or recovered stock capital. Net profit still deducts ALL expenses regardless of their chosen source.

Server saves validate nonnegative finite amounts, two decimals, total <= expense amount, available sales pools and an optimistic revision/expense-amount check. An advisory transaction lock serializes concurrent coverage saves; exact retries do not duplicate allocations. Only Admins can read coverage and execute the write RPC. Staff/anonymous roles have no coverage-table write grants. Expense deletion cascades its coverage. Corrections to sales, purchase costs or expense amounts can invalidate an old allocation; the UI retains negative balances and flags review rather than silently reallocating money. Other income/capital/borrowing are manual attribution and are not pool-limited by this RPC.

Local checks: `node --test tests/*.test.cjs`. Browser fixture `/admin` verifies a 150 expense split as profit 95 and recovered capital 55: sales receipts left 50, net loss still 55. An attempted profit allocation of 96 is rejected. All fixtures are in memory and never contact Supabase.

Before production release, run a transaction/rollback check in Supabase for Admin saves, exact retries, stale edits, invalid/overallocated amounts, and User/anonymous denial. Deploy database first, frontend second. The existing `006_business_finances.sql` update is also pending production application.
