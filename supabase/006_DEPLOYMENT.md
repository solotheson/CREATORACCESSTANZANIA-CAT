# Business position: capital and paid expenses

Prepared locally. Migration and production verification have not been run.

1. Apply `006_business_finances.sql` to the existing Supabase project after migrations 001–005. It adds one admin-only funding table and does not modify existing records.
2. Verify an Admin can create, read, edit and delete a test funding record. Verify User and anonymous roles cannot read or write funding, and inactive Admins are denied. Remove only the test records.
3. Publish the updated frontend, including `assets/js/financial-summary.js`. The frontend remains usable without this migration, but funding controls stay unavailable.
4. As Admin, open **Business position → Record funds**. Enter initial capital and each additional historical contribution, with their actual dates. Include funds originally used for inventory. Do not add current cash as another contribution. Record historical owner withdrawals and loans separately.
5. Reconcile calculated cash against combined actual cash, bank and mobile-money balances. Check missing purchases, expenses and funding rather than inventing a balancing contribution.

## Accounting scope

All recorded sales, purchases, other income and expenses are assumed paid immediately. All-time totals include all recorded dates; there is no historical balance-date selector. Capital is cash invested from the beginning, not an opening snapshot or current stock value. Existing purchases already create cash outflows, so do not enter them as expenses too. Direct owner-funded expenses can be represented by one capital contribution and one expense, with matching amounts.

Expenses remain expenses regardless of whether capital or earned cash paid them. Each expense reduces cash and profit once. There is no additional “pay expense” action. Funding contributions, withdrawals, loan receipts and principal repayments do not change profit. Record interest as an expense. Existing **Loan payment** expenses are flagged for manual review because principal and interest cannot be inferred. Split a mixed payment accurately: principal into funds, interest into expenses, and remove the replaced original after checking the amounts. Preserve totals; do not double count.

Cash = capital + loans received + sales + other income − purchase cost including transport − expenses − withdrawals − loan principal repaid.

Net profit = sales − cost of sold inventory + other income − expenses.

Recorded net worth = cash + physical inventory at purchase cost − outstanding loans. It excludes unrecorded assets or liabilities. Physical stock adjustments change inventory/net worth without moving cash and are shown separately from trading profit. It is not an independent bank reconciliation or a complete statutory balance sheet. Negative cash or negative loan balances are shown with a review message, not clamped to zero.

## Verification

Run `node --test tests/*.test.cjs` for financial examples, funding mapping, missing-migration handling, staff privacy, and existing login/adapter regressions. `node tests/serve-fixture.cjs` serves `/admin` and `/user` with in-memory fake records, without contacting Supabase. Sign in with any syntactically valid email and nonempty password to test forms. Reloading discards fixture data.
