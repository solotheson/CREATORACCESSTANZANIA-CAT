# DIB Stock Control

A shared stock-control app backed by Supabase Authentication and PostgreSQL.

Live site: https://solotheson.github.io/CREATORACCESSTANZANIA-CAT/ (published 28 September 2026). Sign in with your existing DIB account.

Read [App Documentation](APP_DOCUMENTATION.md) for the user guide, account roles, workflows, calculations, troubleshooting, and technical handover.

## Run

Serve this directory over HTTP, for example `python -m http.server 8765 --bind 127.0.0.1`, then open http://127.0.0.1:8765. Sign in using an existing DIB account. No build step is needed. Production should use HTTPS.

The project URL and browser-safe publishable key are in `assets/js/config.js`. The Supabase JavaScript client (2.57.4, MIT) is bundled in `assets/vendor/supabase.js`. Never add a service-role key, secret key, or password to this repository.

## Accounts and workflows

- **Admin:** dashboard, inventory and purchase editing, sales, expenses, other revenue, reports, JSON export, and stock-adjustment history.
- **User:** personal dashboard (today or Monday-to-today in Tanzania time), own sales history, personal expense entry/history, inventory and selling prices, sale entry, and logged physical-stock adjustments. Collection is the recorded sales value before expenses; it is not a separate payment ledger. Purchase costs and other users' records are protected by database policies.
- Remaining quantity = purchased quantity + adjustments − sold quantity.
- Sales and adjustments use transactional database functions. Concurrent sales lock the stock row; a repeated sale request uses the same UUID to avoid selling twice.
- A purchase cost correction recalculates historical profit reports. Sale prices and sale model snapshots remain as originally recorded.
- Unused purchases can be removed. Purchases with sales or adjustment history are protected.
- Saves wait for the server; failures keep forms open. Records refresh after saves, on demand, and every 30 seconds while the page is visible and no form is open.
- Business data and login sessions are held only in the current page's memory. Opening a new tab or reloading requires sign-in. Stored browser sessions and authentication tokens in links are not used to sign in automatically.

## Existing browser records

The former `dib-stock-control-v1` localStorage entry is preserved, but it is not imported or used as database data. The shared database starts empty. Old records must be reviewed and migrated separately; do not copy opening balances and their corresponding sales twice. Export data now downloads a JSON snapshot of the signed-in Admin's shared records, including adjustment history. Reports remain CSV.

## Database and validation

See `supabase/SETUP.md` for installation, permissions, and verification details.

- `node --test tests/database.test.cjs` runs adapter tests (roles, pagination, mapping, RPC retries, error handling).
- `tests/database.sql` exercises the real schema in a transaction and rolls back all fixtures. It targets this project's two existing account UUIDs; adapt those IDs before using another project.
- `node tests/serve-fixture.cjs` serves isolated browser fixtures at http://127.0.0.1:8766/admin and /user. These use fake records and never contact Supabase. They are excluded from deployment.

The GitHub Pages workflow publishes only `index.html`, `assets`, `robots.txt`, and `sitemap.xml`.

For developers and maintainers, see [Technical Manual](TECHNICAL_MANUAL.md). The manuals describe the September integration; use the migration guides below for the latest finance features.

## Business position and expense coverage update

Admins can track owner capital, withdrawals, borrowing and principal repayments in **Business position**, and identify each paid expense's funding sources through **Expenses → Coverage**. Coverage does not deduct an expense twice.

Apply [migration 006](supabase/006_DEPLOYMENT.md) and [migration 007](supabase/007_DEPLOYMENT.md) before using the new save controls. Without these database updates, existing stock and sales workflows remain available while funding and coverage controls are disabled. No historical capital or expense sources are inferred automatically.

Run all local regression tests with `node --test tests/*.test.cjs`.
