# DIB Stock Control - Technician Manual

**Coding, system architecture, and security model**  
**Revision:** 22 September 2026  
**Audience:** Developers, system maintainers, database administrators, and security reviewers

## 1. Scope and implementation baseline

This manual describes the current working-tree implementation: a static HTML/CSS/JavaScript client communicating directly with Supabase Authentication and the Data API. PostgreSQL stores business records and enforces authorization and stock integrity. There is no custom Node.js application server, Firebase backend, or server-rendered framework.

The system serves one company. All active Admins share the business dataset; all active Users share permitted inventory and today's sales. There is no tenant identifier, organization isolation, subscription billing, or ownership filter limiting today's sales to the employee who recorded them.

**Evidence boundary:** Code and SQL were inspected for this manual. Historical test results are separated from proposed tests. This is an implementation guide and code-based security review, not a penetration-test certificate. Live password policies, SMTP, MFA enrollment, token lifetime, backup configuration, network restrictions, and deployed HTTP headers were not audited for this document.

The app has been used locally at http://127.0.0.1:8765. Supabase is remote and must be reachable for reads/writes. The updated frontend has not been published during this work. The original stock import was cancelled; no legacy stock was imported.

| Component | Implemented choice |
| --- | --- |
| Frontend | Static HTML, CSS, classic JavaScript |
| Client library | Bundled supabase-js 2.57.4 UMD |
| Authentication | Supabase email/password sign-in |
| Storage | Supabase PostgreSQL, public schema |
| Server operations | PostgreSQL RPC functions and RLS-protected requests |
| Local serving | Python HTTP server, loopback port 8765 |
| Prepared publication | GitHub Pages; no frontend build step |
| Tests | Node test runner, rollback SQL, isolated browser fixtures |

Source anchors: index.html; assets/js/config.js; assets/js/database.js; .github/workflows/deploy-pages.yml. Section 14 includes source fingerprints because Git HEAD does not include the uncommitted application changes.

## 2. System architecture and trust boundaries

[ARCHITECTURE]

The browser is untrusted: a user can inspect or modify JavaScript, reveal controls, or call APIs outside the app. Permission decisions therefore belong in PostgreSQL. Frontend checks improve usability but do not authorize requests.

The browser downloads static source and the publishable key. Credentials are submitted through the client to Supabase Auth. The client manages access/refresh tokens. Database requests carry session identity, and PostgreSQL obtains the caller UUID through auth.uid(). Provider background: Supabase sessions [R2].

For table requests, grants determine whether an operation is available; row-level security determines which rows it may affect. For stock RPCs, EXECUTE permission allows invocation, while checks inside each function authorize the business action.

### Administrative boundary

The Supabase project owner and privileged database credentials have broader authority than an app Admin. App Admin has business permissions but no browser membership-write grant. Service-role credentials can bypass RLS and must never be shipped in static assets [R1].

The SDK is bundled locally. index.html still loads Google Fonts CSS/fonts. GitHub Actions handles prepared deployment; Supabase hosts Auth, API, and database. Compromised static source can alter the login screen or use a signed-in user's session. Source/deployment access is therefore security-sensitive.

There are no realtime subscriptions, service workers, application API proxy, or offline synchronization worker. Shared updates use polling and explicit reads.

## 3. Code layout and extension points

| File | Responsibility |
| --- | --- |
| index.html | Login, navigation, tables, and business dialogs |
| assets/css/styles.css | Layout and role-dependent visibility |
| assets/js/config.js | window.DIB_CONFIG: URL and publishable key |
| assets/js/database.js | DibDatabase adapter, pagination, conversions, RPCs |
| assets/js/main.js | State, sessions, handlers, rendering, calculations, exports |
| assets/vendor/supabase.js | Bundled client library; license stored beside it |
| supabase/*.sql | Schema, policies, functions, validation, role assignments |
| tests/* | Adapter mocks, database checks, browser fixtures |

Script order is significant: supabase.js, config.js, database.js, main.js. These are classic scripts, not ES modules. main.js reads the DOM immediately; scripts appear after the markup. There is no package.json build, transpilation, bundler, or TypeScript check.

### State and control flow

data holds stock, sales, expenses, revenue, and adjustments. member holds membership; sessionUser holds the Auth UUID. busy serializes mutations in this page only. loadGeneration rejects late responses from superseded refreshes or accounts.

renderAll() redraws screens and applies UI permissions. showView() limits User navigation. applyPermissions() hides views, columns, and actions; it is not authorization. prepareStockForm()/prepareRevenueForm() configure editing state. mutate() waits for a write, closes a successful form, and reloads data.

Some rendering functions remain compressed into long lines. Format and split them deliberately when maintaining them. No automated linting/formatting gate is configured.

### Feature-development sequence

1. Define the database permission and invariants.
2. Add an additive migration and an adapter method.
3. Add the form, rendering, and error handling.
4. Test forbidden access and business integrity, not only the success path.
5. Update the manuals after verification.

Do not expose a table just because a new screen needs data. Select necessary fields and verify grants, RLS, and function ACLs independently of UI visibility.

## 4. Authentication and session lifecycle

Login uses auth.signInWithPassword(). The app neither creates users nor derives roles from an email string, signup metadata, or client role selector. DibDatabase.load(userId) reads membership by Auth UUID and requires active=true with role admin/user.

### Lifecycle

1. Construct the Supabase client with the URL and publishable key.
2. Register onAuthStateChange(). INITIAL_SESSION/SIGNED_IN schedule receiveSession() outside the callback using setTimeout.
3. Clear previous account state, record the new UUID, then load permitted records.
4. Show Dashboard for Admin or Inventory for User.
5. SIGNED_OUT invokes clearAccount(). Explicit sign-out uses scope:'local'.

clearAccount() increments the load generation, empties arrays, resets forms/pending IDs, closes dialogs, and hides the app. refreshData() only applies results when its generation and user UUID still match. Missing/inactive membership clears the UI when detected.

The constructor relies on browser SDK defaults for session persistence and token refresh. Tokens are managed in browser storage; newly loaded business records are held in application memory. The legacy dib-stock-control-v1 entry is preserved, not imported or deleted, so old financial data can remain on devices that used the prototype.

### Revocation limits

Deactivation blocks new business requests through membership checks; it cannot erase previously displayed/exported information. An inactive user can still read their own membership row because member_read permits id=auth.uid(). This exception does not provide business access.

Local sign-out affects the current session, not every device. Issued access JWTs can remain valid until expiry [R3]. Membership checks provide an additional current authorization decision for business requests; in-flight transactions still need consideration. There is no custom all-device revocation workflow.

Password-change and password-recovery screens are not implemented. A Supabase recovery-email action alone does not make the current frontend a complete recovery destination.

## 5. Database structure and invariants

[DATA_MODEL]

| Table | Key fields and constraints |
| --- | --- |
| dib_members | UUID PK/FK to auth.users; display_name; role admin/user; active. Auth deletion cascades membership. |
| dib_stock | UUID PK; brand/model/specs; purchased quantity > 0; sold >= 0; integer adjustment; nonnegative numeric(16,2) selling_price; date. Remaining cannot be negative. |
| dib_purchase_costs | stock_id PK/FK; nonnegative buying_price and transport. Allowed stock deletion cascades its cost row. |
| dib_sales | UUID PK; stock FK; model snapshot; quantity > 0; nonnegative unit_price; date; author Auth FK; created_at. |
| dib_expenses | UUID PK; nonblank category; note; nonnegative amount; date. |
| dib_revenue | UUID PK; nonblank source; note; positive amount; date. |
| dib_stock_adjustments | UUID PK; stock FK; previous/new remaining; nonnegative new count; reason; author Auth FK; timestamp. |

remaining = quantity + adjustment - sold. Unit cost = buying_price + transport / quantity. Each stock row represents one purchase lot; duplicate model names across lots are allowed.

Migration 003 excludes numeric NaN from money columns. Fixed precision/scale, lower-bound checks, and RPC validation provide additional constraints. Counters are PostgreSQL integer. There are no business-specific upper limits on adjustments or database text lengths.

Sales/adjustment stock foreign keys prevent removal of referenced lots. created_by uses the default restrictive Auth foreign-key behavior; deleting an account that authored records may fail. Prefer deactivation when retaining history.

Indexes cover sale date, sale stock_id, and adjustment stock_id, plus primary keys. There are no triggers deriving sold from sales. RPC transactions maintain counters; privileged SQL can violate that convention. Reconcile counters after administrative edits.

## 6. Authorization: grants, RLS, and RPCs

All seven public tables enable RLS. Migration 001 revokes anon/authenticated table access, then grants authenticated SELECT on members, stock, costs, sales, adjustments, and SELECT/INSERT/UPDATE/DELETE on expenses/revenue. Browser roles have no direct write grant on members, stock, costs, sales, or adjustments.

| Policy | Effective authenticated access |
| --- | --- |
| member_read | Own membership, including inactive; active Admin also reads others |
| stock_read | Active Admin/User read all stock rows and columns |
| costs_admin | Active Admin reads private purchase costs |
| sales_read | Admin reads all; User reads all sales dated Tanzania today, not just their own |
| expenses_admin | Active Admin read/write, with USING and WITH CHECK |
| revenue_admin | Same Admin restriction for other income |
| adjustments_admin | Active Admin reads count-adjustment history |

A User SELECT on a private table with SELECT granted generally returns no permitted rows. Missing grants or failed write policies can produce errors. Tests must inspect content, not only HTTP status.

### Definer execution

dib_role() is STABLE SQL SECURITY DEFINER. It looks up auth.uid() and active membership, taking no client-supplied role argument. Under ordinary privileged ownership it can read membership without recursively invoking its RLS policy.

Business RPCs are SECURITY DEFINER with an empty search_path and schema-qualified application tables. PUBLIC/anon EXECUTE is revoked; authenticated EXECUTE is granted. Each RPC checks the caller role before writing. Because execution uses owner privileges, these checks are essential and table RLS alone is insufficient [R1, R4].

The migrations do not FORCE RLS or specify a custom least-privilege function owner. Verify live ownership and grants. Review ACLs for every new function rather than assuming defaults are safe. Moving the role helper into an unexposed schema and narrowing function ownership are possible improvements; no such changes were applied for this manual.

## 7. Database API contracts

Operations use the signed-in session through DibDatabase. No service-role key is needed. check() throws Supabase errors so callers can distinguish a successful write from a failed reload.

| RPC | Contract |
| --- | --- |
| dib_role() | Returns active caller role or NULL. Authenticated only. |
| dib_save_stock(p_id uuid, p_item jsonb) | Admin-only stock/cost upsert in one transaction; returns UUID. Null ID generates a UUID; UI supplies one. |
| dib_record_sale(p_id uuid, p_stock_id uuid, p_quantity integer, p_unit_price numeric, p_date date) | Admin/User; locks stock, checks available quantity, records author, increments sold. Returns UUID. User date must be Tanzania today. |
| dib_adjust_stock(p_stock_id uuid, p_remaining integer, p_expected_remaining integer, p_reason text) | Admin/User; locks stock, rejects stale expected count, logs count/author, updates adjustment. Returns void. |
| dib_delete_sale(p_id uuid) | Admin-only; locks stock, deletes sale if present, restores its quantity once. Returns void. |
| dib_delete_stock(p_id uuid) | Admin-only; foreign keys protect lots with history. Returns void. |

### Example purchase request

```javascript
await database.saveStock(crypto.randomUUID(), {
  brand: 'HP', model: 'Example model', screen: '14 inch',
  processor: 'i5', ram: '8GB', storage: '256GB',
  quantity: 10, buyingPrice: 400000, transport: 200000,
  sellingPrice: 500000, date: '2026-09-22'
});
```

This illustrates a contract; do not execute it against production as a test. The payload uses buyingPrice/sellingPrice while tables use snake_case. transport is a lot total. Optional specification strings default to empty in SQL.

saveEntry(table,id,values) accepts only dib_expenses/dib_revenue and performs upsert(...).select('id').single(). deleteEntry() restricts the same table names and requires a returned row. The database permits Admin expense updates although the current expense screen exposes add/delete only. UI controls do not narrow actual database grants.

There is no API versioning layer. Function parameter names and JSON property names are compatibility contracts for deployed clients. Preserve them or coordinate a database/client migration.

## 8. Concurrency, retries, and accounting

### Sale transaction

The RPC checks role/input and User date, then SELECTs stock FOR UPDATE. It looks up the sale UUID and compares stock, quantity, price, date, and author. An exact replay returns that UUID without changing stock. Otherwise it verifies remaining quantity, inserts the sale, and increments sold atomically.

Competing sales on one lot serialize on the row lock. With one unit remaining, the first one-unit sale succeeds; the second observes the changed counter and fails. This is supported by the code design, but simultaneous live-client load testing has not yet been performed.

main.js retains pendingSale = {id, signature} after an ambiguous network error and prevents changed-payload submission until resolved. A recognized database error clears the marker. The marker exists only in memory: reload/sign-out loses it. Check for an existing sale before submitting a new request after reloading.

A User retry after midnight for yesterday's sale fails the date check before the existing-UUID check. A direct API caller supplying more than two decimal places may also encounter a mismatch after stored numeric rounding. The UI uses two-decimal inputs. Server-side normalization and explicit midnight tests are recommended improvements.

### Adjustments and deletion

Adjustments use expected count rather than a request UUID. A lost success response can make a retry appear stale. Refresh and inspect history before correcting again. Two conflicting adjustments based on one prior count cannot silently overwrite a changed count.

Delete-sale checks deletion after locking stock, so retries do not restore stock twice. There is no tombstone: deleting a sale removes its idempotency record. A later stale create request using that UUID can recreate it. Deletions also lack a comprehensive immutable audit trail.

### Last-write and cost behavior

Purchase/expense/revenue upserts have no expected version or updated_at condition. Two Admin edits can overwrite fields from a stale form. Row locks do not prevent this last-write-wins behavior.

Sale price/model are snapshots; cost of sales is calculated from current purchase cost. Correcting purchases changes historical profit. Client arithmetic uses JavaScript Number, not exact-decimal calculations, and monetary displays round to whole TZS. The app is not a complete accounting ledger.

## 9. Loading, rendering, and failure handling

rows() uses keyset pagination: order by id (stock_id for costs), limit 500, then gt(key,lastKey). This avoids silently truncating data at the API's common default limit. load() checks membership before fetching the role's table set concurrently. Admin costs are joined in JavaScript by stock_id.

The adapter converts numeric values with Number() and maps selling_price to sellingPrice, stock_id to stockId. A missing cost row becomes zero: this is a display fallback, not evidence of a free purchase. Include missing-cost checks in reconciliation.

A refresh spans separate table requests and potentially multiple pages. It is not a transactional financial snapshot. Concurrent writes can produce a mixed-time view; there is no consistent server-side reporting snapshot or incremental feed. Loading all permitted rows also has memory and request-volume implications as the dataset grows.

mutate() disables dialog buttons/Refresh during a page-level write and waits for the server. Write success followed by reload failure produces a saved/refresh-needed message. Write failure keeps the form open. This distinction matters when diagnosing duplicates.

Polling runs every 30 seconds only with a member, a visible document, no dialog, and no write. Failed refreshes can leave stale records visible. Tanzania dates come from Intl.DateTimeFormat client-side; SQL uses now() at time zone Africa/Dar_es_Salaam. The database is authoritative for restricted sale dates.

Current record-text paths use escaping before HTML interpolation or textContent. CSV generation escapes quotes and prefixes formula-leading strings. These controls reduce injection risk for these paths, but do not make arbitrary future HTML/URL/spreadsheet interpolation safe. Review new innerHTML use carefully.

## 10. Threat model and security limitations

| Threat or failure | Control and remaining exposure |
| --- | --- |
| Anonymous business-data access | No anon table grants; active membership required. Publishable key remains intentionally public. |
| Self-promotion to Admin | No browser membership-write grant; roles are database records, not user metadata. |
| Private cost disclosure | Separate cost table with Admin-only RLS; User adapter skips it. |
| Historical sale disclosure | SQL date predicate enforces today's visibility. All employees' sales today are visible to User. |
| Abusive stock adjustment | Any active User can set any nonnegative count with a reason. Logging exists; no approval or magnitude limit. |
| Sale below cost | Zero/nonnegative prices are accepted; no margin or discount-approval rule. |
| XSS or compromised device | Escaping helps, but a same-origin executing script can use the active session and accessible data. |
| API exhaustion | No custom request-rate limiter; provider configuration was not reviewed. |
| Compromised deployment | Altered static code can capture credentials/use sessions. Repository and deployment controls were not audited. |
| Data loss | No in-app restore, deletion recycle bin, or full immutable ledger. JSON export is not a full backup. |

### Unverified or missing safeguards

There is no app-enforced MFA challenge or authentication-assurance-level check in policies. Provider MFA configuration was not verified. Password strength, breached-password checks, CAPTCHA, SMTP, and recovery redirect allowlists require a project review.

index.html has no CSP meta tag; the workflow does not configure a security-header layer. Actual hosting headers were not audited. Assess CSP, anti-framing, referrer policy, HTTPS, and external font loading before public release. These are recommendations, not statements about an inspected deployed server.

Persistent browser tokens create shared-device/XSS exposure. Old localStorage financial records can remain from the prototype. Arrange an explicit retention/export decision before removing them.

Provider context: [R1]-[R4]. This table documents actual trust assumptions and gaps; it does not claim security certification.

## 11. Operations, accounts, and recovery

Verified roles: solomoniyona96@gmail.com is Admin; userdib@gmail.com is User. Roles bind to Auth UUIDs. Recreating an email account produces a new UUID and needs a new membership. Migration 002 refers to deleted accounts; migration 004 records replacements.

### Account maintenance

Use an authorized project owner account. Verify UUID, confirmed email, and current membership before altering role/active. Prefer deactivation to preserve author references. It prevents subsequent authorized business requests, but does not erase exported data. Do not edit auth.users manually to set passwords; use supported account tools. Never put credentials in source, migrations, or support messages.

Complete a recovery event handler, private password-entry UI, redirect allowlist, and tests before depending on password-reset emails. Those components are not currently implemented.

### Read-only reconciliation

```sql
-- Counter drift: expected to return no rows.
select s.id, s.sold, coalesce(sum(x.quantity),0) as sale_units
from public.dib_stock s
left join public.dib_sales x on x.stock_id=s.id
group by s.id
having s.sold <> coalesce(sum(x.quantity),0);
```

```sql
-- Missing cost row: expected to return no rows.
select s.id, s.model from public.dib_stock s
left join public.dib_purchase_costs c on c.stock_id=s.id
where c.stock_id is null;
```

Use an owner/Admin context that sees all rows. User's restricted sales visibility invalidates full-history reconciliation. Investigate before repairing; adjustments intentionally change inventory independently of sales.

### Recovery and incident response

Define retention and recovery objectives, take an appropriate database backup, and prove restoration in a separate project. Include schema, functions, policies, Auth dependencies, and memberships. UI JSON export omits Auth and memberships and has no automated restore tool. No backup/recovery plan was established by this implementation.

For suspected misuse, deactivate the membership, review authorship/provider logs, and use supported session/account controls. For a leaked privileged key, rotate it and review privileged activity; rotating the public key alone is insufficient containment. Preserve evidence before destructive cleanup. There is no automated incident-response workflow in this app.

## 12. Development, migrations, and deployment

### Local workflow

```powershell
python -m http.server 8765 --bind 127.0.0.1
node --check assets/js/main.js
node --check assets/js/database.js
node --test tests/database.test.cjs
```

Python's server is for loopback development, not hardened production. It serves the project directory to that local origin. Keep it bound to 127.0.0.1 and keep secrets out of the tree.

node tests/serve-fixture.cjs serves /admin and /user on port 8766. session-fixture.js replaces the adapter with fake records and does not call Supabase. Do not publish these fixtures or confuse them with authenticated production tests.

### Migration management

001 created schema/functions; 003 added validation/indexes; 004 assigned replacement accounts. 002 is historical. There is no automated migration ledger. Initial DDL is not idempotent; replaying it blindly fails. Record applied changes separately.

For a new project, apply initial schema/validation, create intended Auth accounts, then adapt memberships to its verified UUIDs. For an existing project, add a numbered migration, review compatibility, use controlled transactions where appropriate, and verify grants/RLS afterward. Do not rewrite applied history to conceal changes.

### Publication path

The workflow runs on main pushes or manual workflow_dispatch on GitHub-hosted Ubuntu. It has contents:read, pages:write, and id-token:write permissions. It stages index.html, robots.txt, sitemap.xml, and assets in _site and deploys that artifact. Tests, SQL, and docs are excluded, but everything in assets is public. Inspect that directory before release.

The deployment workflow has no automated test step. Action versions use tags rather than immutable commit hashes. Proposed improvements include required tests, protected main, dependency monitoring, explicit source/artifact versions, and staging checks. Reverting the frontend cannot reverse a database change; plan database rollback or forward repair separately.

## 13. Verification and maintenance priorities

| Evidence | Meaning and boundary |
| --- | --- |
| Five adapter tests passed during integration | Role-based requests, mapping, pagination across 1,101 rows, retained RPC IDs, propagated errors, and secret-key rejection. Mocked, not real Auth/RLS. |
| Rollback SQL previously returned PASS | Role restrictions, oversell rejection, sale replay/deletion, stale adjustment, foreign-key history protection, and NaN rejection. Test changes rolled back. |
| Isolated browser checks | Admin sale totals and User adjustments/visibility with fake records; not production writes. |
| Owner-confirmed login and role lookup | Replacement login and active role mapping, not every workflow. |

SQL fixture UUIDs were updated for replacement accounts after the earlier successful run. This documentation task did not rerun that modified SQL suite or alter production data. Run it in staging first. It temporarily changes membership and uses elevated SET ROLE/request claims inside a transaction; never expose it as a browser endpoint. If a statement fails, ROLLBACK explicitly and investigate instead of selectively continuing.

### Before broader use

1. Authenticate through the real API as Admin, User, inactive, and unassigned users; assert forbidden reads/writes directly.
2. Run two clients against one lot; verify oversell prevention and one application of a repeated sale UUID.
3. Test timeout-after-commit, page reload before retry, precision rounding, and midnight changes.
4. Test simultaneous Admin edits and fix or document last-write-wins behavior.
5. Test sign-out, role changes, stale responses, and missing costs across tabs/devices.
6. Restore a backup separately and reconcile it before declaring recovery ready.
7. Inspect the publication artifact and verify HTTPS, redirects, and security headers.

### Engineering priorities

Before public release: complete recovery, verify Auth/security settings, establish tested backups, add release checks, and confirm User adjustment/discount authority with the owner. Next: version checks on edits, consistent report snapshots, durable request IDs/tombstones, fuller auditing, and precise monetary arithmetic.

Before subscription/multi-company use: design tenant keys, isolation policies, tenant-scoped constraints, and provisioning. Existing admin/user roles are not tenant isolation. These priorities are proposed work, not features added by this manual.

## 14. Source traceability and references

The manual describes working-tree files inspected on 22 September 2026. Git HEAD is a78bf8a5cc1f8ce4a3b9c7d0b423c3eb3a908c63, but application changes are uncommitted. Use the SHA-256 manifest below to identify the source snapshot. Fingerprints identify content, not its security quality.

**index.html**

`a41f6e760a4e45c59c0a257b7df7f1f01988e8c332bd6a649b0fb03f9cea667c`

**assets/js/main.js**

`4d23a723da0b4e4fdf23b0874b1c9ff850bc7e52efef95a968e3293395807bd4`

**assets/js/database.js**

`eda0e5d49d3b80a99f0d4de09f77a6946e39296a095263d713595b363a7bcfed`

**assets/js/config.js**

`dc37ae64e60b95dc7d36e853ac77477dea2dcce6471e8f6714a9502f81b79902`

**supabase/001_initial.sql**

`9cda7f57cd3a22cd2e2b241ca56ee2f6ca9864434d676c39b610b98dfab962ff`

**supabase/003_validation.sql**

`2653d2587fab4ac936d41a87af17d5982b5e59ff50128ed4c67a7cb2653a490c`

**supabase/004_replace_accounts.sql**

`9df30414bb2514f603a272165838d2f576f52adb6ec9f5acc0384b0770f32093`

**.github/workflows/deploy-pages.yml**

`217d00a2a22125ddac8b06888ae193fdb16b2c3670143606d8ba07d4b0a0c70b`

**tests/database.test.cjs**

`9f77f69e7d5bf1b1a0cb15e90cbde5811020d649ec011bc4ab1ae09e38422079`

**tests/database.sql**

`1be14305b77e30c273a4118610add84504976e98bc0289d95f9a7f670c570fc9`

### Provider references

[R1] Supabase - Row Level Security. Policies, service-role bypass, and definer considerations. https://supabase.com/docs/guides/database/postgres/row-level-security

[R2] Supabase - User sessions. Access/refresh-token session model. https://supabase.com/docs/guides/auth/sessions

[R3] Supabase JavaScript - signOut. Local scope and access-token expiry limitation. https://supabase.com/docs/reference/javascript/auth-signout

[R4] Supabase - Securing your API. Grants, RLS, and exposed functions. https://supabase.com/docs/guides/api/securing-your-api

Reviewed 22 September 2026. Code or configuration changes can invalidate this snapshot.
