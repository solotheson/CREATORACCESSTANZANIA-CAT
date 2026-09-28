# Personal dashboard and expenses

Applied to production on 28 September 2026 with user approval.

1. Apply `005_user_dashboard_expenses.sql` in the existing project SQL editor.
2. Run `tests/personal-access.sql`; it rolls back all fixtures and must return PASS.
3. Publish the frontend only after the database succeeds.

The User role (currently userdib@gmail.com) reads only its own sales history and expenses. Expense creation uses a validated, retry-safe RPC that assigns the authenticated user's ID. Users cannot edit/delete expenses or assign them to someone else. Admin retains full visibility and correction access. Existing expenses have no known owner and remain Admin-only; no ownership is guessed.

The personal dashboard offers today or Monday-through-today in Africa/Dar_es_Salaam, with transaction count, units, sales value, and expense totals. Collection means recorded sale value, not payment reconciliation.

Local verification: 11 Node tests passed, including owner filtering, date boundaries, RPC arguments, and login regression checks. Browser fixtures verified user expense creation and dashboard updates plus the existing Admin dashboard. Production migration succeeded. The live SQL regression returned PASS for personal ownership, historical sales, expense retry safety, validation, and Admin access. All test fixtures were rolled back.
