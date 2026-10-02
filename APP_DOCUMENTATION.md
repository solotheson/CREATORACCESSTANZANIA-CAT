# DIB Stock Control — App Documentation

**User and administrator guide · 22 September 2026**  
**Business:** DIB COMPANY  
**Currency:** Tanzanian shillings (TZS)  
**Business timezone:** Africa/Dar_es_Salaam

## 1. Purpose and current status

DIB Stock Control manages laptop purchases, remaining inventory, sales, operating expenses, and other revenue in a shared database. It provides separate Admin and User access.

The application uses Supabase for account authentication and PostgreSQL for business records. The current updated app runs locally at **http://127.0.0.1:8765/** while its local server is running. That address works on the computer running the server; it is not a public website address. The updated app has not yet been published online.

The original stock import was cancelled at the owner's request. **No old stock was imported.** Enter new purchases manually unless a separate import is explicitly arranged.

## 2. Accounts and access

| Account | Role | Main responsibility |
| --- | --- | --- |
| solomoniyona96@gmail.com | Admin | Manage stock, purchases, sales, expenses, revenue, and reports |
| userdib@gmail.com | User | View inventory, record today's sales, and adjust remaining stock |

These replacement accounts and their active roles were verified on 22 September 2026. Passwords are not included in this documentation.

### Permission matrix

| Feature | Admin | User |
| --- | --- | --- |
| Dashboard | Yes | No |
| Inventory and selling prices | View | View |
| Buying prices and transport costs | View and edit | No access |
| New stock / purchases | Add | No access |
| Purchase corrections | Edit | No access |
| Physical stock adjustment with a reason | Yes | Yes |
| Sales visibility | All recorded dates | Today only, Tanzania time |
| Record a sale | Select sale date | Today only |
| Delete a sale and restore its stock | Yes | No |
| Expenses | Add and delete | No access |
| Other revenue | Add, edit, and delete | No access |
| Reports and stock-adjustment history | Yes | No |
| JSON export and CSV report | Yes | No |
| Create accounts or assign roles | Project owner through Supabase | No |

Being an app Admin does not automatically grant access to the Supabase project dashboard. Database policies enforce the restrictions independently of the buttons shown in the app.

## 3. Sign in and sign out

1. Open the app address.
2. Enter the email and password for your DIB account.
3. Select **Sign in**.
4. Check the account name and role displayed at the top of the page.

Admin opens on the Dashboard; User opens on Inventory. The login session can remain active after a page reload. Use **Sign out** when finished on a shared computer. If you were signed in with a deleted account, sign out and use your replacement account.

### Password changes and account recovery

The current app has no Change password or Forgot password screen. Supabase's account page provides a password-recovery email action, but the app's recovery screen and redirect configuration still need implementing before relying on that email flow. Contact the project owner if you cannot sign in; do not share your password in chat or documentation.

## 4. Add a purchase — Admin

Use **+ Add stock**, **Inventory → + Add stock item**, or **Purchases → + New purchase**. They open the same purchase form.

| Field | What to enter |
| --- | --- |
| Brand and model | Laptop identification, such as HP and 840G6 |
| Screen size, processor, RAM, storage | Specifications to distinguish the item |
| Total quantity purchased | Number bought in this purchase lot; a positive whole number |
| Buying price / unit (TZS) | Cost of one laptop, already converted into TZS |
| Total transport (TZS) | Transport allocated to the entire purchase lot |
| Selling price / unit (TZS) | Default selling price for one laptop |
| Purchase date | Date of the purchase |

Select **Save stock** and wait for the confirmation. The record appears in both Inventory and Purchases.

Each row represents a purchase lot. A new delivery of an existing model can be entered as a separate purchase, especially when its buying cost is different. The app does not merge identical model names automatically.

**Example:** Buy 10 laptops at TZS 400,000 each, with TZS 200,000 total transport. Total purchase cost is TZS 4,200,000, and cost per laptop is TZS 420,000.

There is no AED exchange-rate field in the current app. Convert foreign-currency costs to TZS before entering them.

## 5. View and correct inventory

### Search and filters

Search by model, brand, or processor. Inventory displays specifications, selling price, available quantity, and remaining value at selling price. Admin also sees cost per unit.

The filter labels currently mean:

| Filter | Available quantity |
| --- | --- |
| All stock | All purchase lots |
| In stock | More than 3 units |
| Low stock | 1–3 units |
| Out of stock | 0 units |

The Dashboard's low-stock list includes both low-stock and sold-out items.

### Correct a purchase — Admin

Select **Edit** in Inventory or Purchases. Correct the purchase fields and save.

The quantity field is the **total originally purchased**, not the current remaining quantity. To correct a physical stock count, use **Adjust stock** instead.

Changing the buying price, transport, or purchased quantity changes the calculated cost per unit. This also recalculates historical gross profit for sales from that purchase lot. Recorded sale prices and sale model snapshots remain unchanged.

### Adjust a physical stock count — Admin or User

1. Open Inventory and select **Adjust stock** for the relevant lot.
2. Enter the actual remaining quantity, not the difference.
3. Enter a reason, such as “Physical count: one damaged laptop removed.”
4. Select **Save adjustment**.

The app records the previous quantity, new quantity, reason, account ID, and time. It preserves the purchase quantity. Admin can review the log under **Reports → Stock adjustment history**.

If another person changes the stock while your form is open, the database rejects a stale adjustment. Close the form, select **Refresh**, reopen the adjustment, and review the current quantity before trying again.

An adjustment changes inventory quantity and value; it does not automatically create an expense or write-off transaction.

### Remove unused stock — Admin

Select **Remove** and confirm. A purchase linked to any sale or stock adjustment cannot be removed. Correct it using the appropriate edit or adjustment workflow instead.

## 6. Record and correct sales

1. Open **Sales** and select **+ Record sale**.
2. Select the purchase lot. Only lots with available stock appear.
3. Enter the quantity sold.
4. Check the selling price per unit; the app fills the default price from stock.
5. Check the sale date. A User can record today's sales only.
6. Select **Save sale** and wait for confirmation.

The database records the sale and reduces available stock together. It rejects a quantity greater than the remaining stock. When two people sell the same lot, the database serializes the stock update to prevent overselling.

Admin can see revenue, cost, and profit for all recorded sales. User sees today's quantities and sales amounts without buying costs or profit.

### Correct an incorrect sale — Admin

There is no Edit sale action. Review the incorrect record, select **Delete**, and confirm; its quantity is restored to stock. Record the corrected sale if appropriate. There is no in-app trash or undo for deleted sales.

### If a sale save is interrupted

If the connection fails and the form stays open, retry the same sale with the same details. Within the current page session, the app retains its request identifier to prevent the same retry reducing stock twice.

Before re-entering a sale after reloading the page, check the Sales list: the original request may have succeeded. The pending request identifier is not preserved across page reloads. If an interrupted User sale crosses midnight, ask Admin to check its historical date before re-entering it.

## 7. Record expenses — Admin

Open **Expenses → + Add expense**. Choose a category, enter the amount in TZS, add a note, select the date, and save.

Available categories are Rent, Wages, Loan payment, Office / design, Transport, and Other. The current screen supports adding and deleting expenses; it does not have an Edit expense button. To correct an entry, review it, delete it, and add the corrected record.

Transport entered on a purchase is already included in that purchase's cost. Avoid entering the same amount again as an expense unless that is intentionally how you want it reflected in these app totals.

## 8. Record other revenue — Admin

Use **Other Revenue → + Add revenue** for income outside laptop sales, such as repair services or commission. Enter the source, an amount greater than zero, a note if needed, and the date received.

Use **Edit** to correct the record or **Delete** to remove it. Other revenue contributes to the net position, but it does not reduce or change the original expense records. Do not enter a laptop sale here if it is already recorded in Sales.

## 9. Understand the Dashboard and Reports

Admin's Dashboard shows available stock, stock value at purchase cost, sales revenue, net position, low-stock items, recent transactions, and potential remaining stock profit. Reports provides further totals and the adjustment history.

| Figure | Calculation |
| --- | --- |
| Available quantity | Purchased quantity + stock adjustments − sold quantity |
| Unit cost | Buying price per unit + total transport ÷ purchased quantity |
| Total purchase cost | Buying price per unit × purchased quantity + total transport |
| Sale total | Quantity sold × sale price per unit |
| Cost of sold stock | Quantity sold × current unit cost of its purchase lot |
| Gross profit | Sales revenue − cost of sold stock |
| Other revenue | Sum of other-revenue entries |
| Net position | Gross profit + other revenue − expenses |
| Expenses after other revenue | Expenses − other revenue, with a minimum of zero |
| Remaining stock value | Sum of available quantity × unit cost |
| Stock at selling price | Sum of available quantity × set selling price |
| Potential remaining profit | Sum of available quantity × (set selling price − unit cost) |

These totals reflect the records entered in the app. Net position is not a bank balance: the app does not separately track customer payments, unpaid invoices, bank balances, taxes, or financing balances. Monetary cards round their display to whole TZS; stored monetary inputs can include two decimal places.

Admin reports currently cover all loaded records. There is no date-range report filter.

## 10. Export and backups

Select **Refresh** before exporting when you need the latest shared records.

| Action | Output | Contents |
| --- | --- | --- |
| **Export data** in the top bar | `dib-stock-backup.json` | Stock with purchase costs, sales, expenses, other revenue, stock adjustments, and export timestamp |
| **Reports → Download CSV** | `dib-stock-report.csv` | Generation date and summary financial metrics |

JSON export does not include passwords, Auth accounts, or role memberships. The app has no JSON/CSV restore or import screen. Keep exports in a secure location; restoring them requires a separate controlled process.

The export is a manually requested snapshot, not a scheduled backup. This implementation did not establish an automated backup or verify a recovery plan; review the project's backup arrangements separately.

## 11. Shared updates and connection problems

The app loads shared data after sign-in, refreshes it after a successful save, and provides a **Refresh** button. It also refreshes approximately every 30 seconds when the page is visible, an account is loaded, no save is running, and no form is open.

The current app requires connectivity to Supabase for loading and saving. It has no offline save queue. During a refresh failure, it can continue displaying the last loaded data, which may be out of date.

| Message or symptom | What to do |
| --- | --- |
| Invalid login credentials | Check the account email and password. Use the replacement account rather than a deleted login. |
| No active DIB membership | Ask the project owner to verify your Auth account ID has an active role in `dib_members`. |
| Not enough stock | Refresh inventory and review the sale quantity. Another sale may have changed it. |
| Stock changed / refresh before adjusting | Close and reopen the adjustment after refreshing, then enter the current physical count. |
| Saved to the database; refresh needed | The save succeeded, but reloading records failed. Refresh instead of entering the same record again. |
| Retry the original sale | Resolve the interrupted request with the same details before entering another sale. |
| Offline / refresh failed | Check connectivity and retry Refresh. Do not assume displayed totals are current. |
| Purchase cannot be removed | It has linked sales or adjustment history. Use a correction workflow. |
| Only Inventory and Sales are visible | This is expected for the User role. |
| Local app address does not open | The local server may be stopped. Follow the startup instructions below. |
| Old stock is missing | It was deliberately not imported. Add confirmed purchases manually. |

## 12. Technical handover

### Local startup

From `C:\Users\solom\DIB PLATFORM\Website`, run:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765 in a browser. No frontend build is required. Keep the server running while using this local address. Supabase connectivity is still needed.

### Main files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and forms |
| `assets/css/styles.css` | Layout, appearance, and visibility styles |
| `assets/js/main.js` | Screen rendering, login lifecycle, form handling, reports, and exports |
| `assets/js/database.js` | Supabase queries, role-aware loading, pagination, and database calls |
| `assets/js/config.js` | Project URL and browser-safe publishable key |
| `assets/vendor/supabase.js` | Bundled Supabase JavaScript client |
| `supabase/SETUP.md` | Database setup, migration history, and access rules |
| `tests/database.test.cjs` | Automated data-adapter tests |
| `tests/database.sql` | Transactional database checks using the configured account IDs |
| `.github/workflows/deploy-pages.yml` | GitHub Pages publication workflow |

### Database structure

| Table | Responsibility |
| --- | --- |
| `dib_members` | Account display name, role, and active status |
| `dib_stock` | Purchase-lot specifications, quantity counters, selling price, and date |
| `dib_purchase_costs` | Admin-only buying price and transport allocation |
| `dib_sales` | Sale quantity, price, date, model snapshot, and author |
| `dib_expenses` | Expense category, amount, note, and date |
| `dib_revenue` | Other-income source, amount, note, and date |
| `dib_stock_adjustments` | Physical-count changes, reasons, authors, and timestamps |

All seven tables have row-level security. Stock and sales writes use database functions that check roles and enforce stock integrity. Account roles are associated with Auth user IDs; changing an email in a document or recreating an account does not automatically assign a role to a new ID.

The project uses Supabase, not Firebase. The project reference is `tpxzmybbcnyblgvavghs`. The frontend contains a publishable key only; privileged keys and passwords must not be added to it.

### Migration history

- `001_initial.sql`: original tables, policies, and stock/sales functions; already applied.
- `002_assign_roles.sql`: historical assignments for the deleted accounts; do not rerun on this project.
- `003_validation.sql`: monetary validation and stock-adjustment index; already applied.
- `004_replace_accounts.sql`: assignments for the current Admin and User accounts; applied and verified.

Do not rerun initial schema migrations against the existing project. See `supabase/SETUP.md` for provisioning another project with its own account IDs.

### Validation and deployment

Run adapter tests with:

```powershell
node --test tests/database.test.cjs
```

Five adapter tests passed during integration. Database role and stock-integrity checks also passed with their test changes rolled back. Isolated browser fixtures exercised Admin sales and User adjustments. The owner confirmed successful login with the replacement account. These checks are not a full concurrent-load test or disaster-recovery test.

The GitHub Pages workflow publishes on a push to `main` or a manual workflow run. It packages only `index.html`, `assets`, `robots.txt`, and `sitemap.xml`; local documentation, SQL, and test fixtures are excluded. The current updated source has not yet been published during this work.

## 13. Current scope and missing features

This is a single-company stock application. The following are not currently implemented:

- Public self-registration or an in-app account-management screen.
- Change-password and password-recovery screens.
- Automated legacy-stock import or export-file restore.
- Multi-company subscriptions, monthly billing, or payment collection.
- Customer/supplier records, invoices, receipts, or payment-status tracking.
- Tax calculation, bank reconciliation, or a full accounting ledger.
- Serial-number tracking, multiple warehouses, or transfer workflows.
- Date-range reports, offline saving, or a recycle bin for deleted records.
- A complete audit trail for every business edit; the visible audit history covers stock adjustments.

These items are documented as limitations, not as promised functionality.
