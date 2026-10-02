# DIB Supabase setup

Project: `tpxzmybbcnyblgvavghs` (DIB COMPANY).

## Current status — 2026-09-22

- `001_initial.sql` was applied on 2026-09-18. Do not rerun it on this project.
- The owner replaced both Auth accounts. `004_replace_accounts.sql` was applied successfully and the live memberships were verified on 2026-09-22: `solomoniyona96@gmail.com` is active Admin and `userdib@gmail.com` is active User. Both emails are confirmed. `002_assign_roles.sql` is historical and references deleted accounts; do not rerun it on this project.
- `003_validation.sql` was applied on 2026-09-21. It rejects non-finite monetary values and blank brands and indexes stock adjustment history. Do not rerun it on this project.
- The frontend is connected with the public publishable key and bundled Supabase client.
- The shared stock and sales tables were empty at verification. Existing localStorage data has not been imported.

For a new empty project, run 001 and 003, create the intended confirmed Auth accounts, then adapt 004 to their actual IDs/emails and run it. Do not reuse this project's account UUIDs in another project. Replace the URL and publishable key in `assets/js/config.js`. Never place secret keys or account passwords in client code.

## Access model

All seven business tables enforce row-level security. Anonymous table access is revoked. Unassigned and inactive accounts cannot access business records. Membership is assigned only by the project owner, never from signup metadata.

| Data / action | Admin | User |
| --- | --- | --- |
| Inventory and selling prices | Read | Read |
| Purchase costs | Read and edit via stock RPC | Denied |
| Sales | Read all, record, delete via RPC | Read and record today only |
| Remaining stock adjustment | RPC with reason and expected count | Same |
| Expenses and other revenue | Read, create, edit, delete | Denied |
| Stock adjustment history | Read | Denied |
| Membership management | Project owner dashboard only | Denied |

Business dates use `Africa/Dar_es_Salaam`. A User's history query is constrained by the database, independently of the UI.

## Tables and integrity

`dib_members` links Auth users to active application roles. `dib_stock` stores each purchase lot and stock counters. `dib_purchase_costs` separates private buying costs from the public-to-members stock fields. `dib_sales` records sale snapshots and authors. `dib_expenses` and `dib_revenue` hold operating transactions. `dib_stock_adjustments` keeps before/after physical counts, reasons, authors, and timestamps.

Stock/sale writes use security-definer functions with an empty search path and explicit role checks. These functions lock the affected stock row. Sales are idempotent by UUID; adjustments reject stale expected counts. Sale deletion restores stock exactly once. Foreign keys protect purchases with history. Money is fixed-precision numeric, quantities are integers, and stock cannot become negative.

The current accounting behavior intentionally recalculates historical cost of sales after a purchase cost correction. Each stock row is one purchase lot, not an aggregated product master. This is a single-company design, not a multi-tenant subscription platform.

## Verification performed

The real Supabase SQL editor returned PASS for `tests/database.sql`: Admin access, User cost/history restrictions, denied purchase and expense writes, anonymous/unassigned/inactive access restrictions, oversell rejection, idempotent sale retry/deletion, stale adjustment rejection, stock-history protection, and NaN rejection. All fixtures and the temporary inactive flag were rolled back.

Five Node adapter tests passed, including pagination across 1,101 records. Isolated browser fixtures verified Admin sales totals and User stock adjustments/hidden private controls. The live sign-in page loaded without console errors. The account owner confirmed that a real login reached the DIB dashboard in a separate browser; that authenticated browser was not directly inspected by the agent. Simultaneous-client load testing and a real browser sale against production were not performed.

Database backup/recovery must be reviewed separately in the Supabase project; this implementation did not establish or verify an automated backup plan. The Admin JSON export is an additional snapshot, not an automated backup or restore system.

Client references: [Supabase initialization](https://supabase.com/docs/reference/javascript/initializing), [auth state events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

The role change requires no frontend email changes: the app reads membership by the signed-in Auth user ID. Sign out of any old session, then sign in with a replacement account and its current password.
