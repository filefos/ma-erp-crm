# Prime Max & Elite Prefab ERP CRM

## Overview

Full-stack ERP + CRM system for two UAE prefab construction companies:
- **Prime Max Prefab Houses Industry LLC** (prefix: PM)
- **Elite Pre-Fabricated Houses Trading Co. LLC** (prefix: EP)

pnpm workspace monorepo with React+Vite frontend, Express 5 backend, PostgreSQL + Drizzle ORM.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifact: erp-crm, port 24746, preview path `/`)
- **Backend**: Express 5 (artifact: api-server, port 8080, preview path `/api`)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/`)
- **Auth**: JWT (stored in localStorage key `erp_token`, sent as `Authorization: Bearer`)
- **Charts**: Recharts (on dashboard)

## Key Commands

## Modules / Features
- Sales: Quotations (with revision bump R00→R01), Proforma Invoices, Delivery Notes, Invoices
  - **Payment-term-driven invoice generator** (`src/lib/payment-terms.ts`): 6 presets (100% advance, 75/25, 50/50, 25/75, 25/50/25, 25/25/25/25); parser for free-form payment-terms text. Quotation new/edit pages have a preset dropdown that fills the payment-terms input. Quotation detail's "Convert" action opens a dialog showing parsed installments (editable label/% + add/remove + per-row select), then sequentially creates one Proforma or Tax Invoice per selected installment with proportional subtotal/VAT/total. Per-installment try/catch keeps the loop going on errors. List query keys are invalidated after creation. Calculator absorbs cent-rounding drift into the final installment.
  - **Editable invoices**: `proforma-invoice-edit.tsx` and `accounts/invoice-edit.tsx` allow full edit of client info, dates, totals, VAT %, status, payment terms, and pass extra (non-OpenAPI) fields like `vatPercent`, `clientTrn`, `amountPaid`, contact/location/notes via cast spread — server persists them via `...rest` spread. Routes: `/sales/proforma-invoices/:id/edit`, `/accounts/invoices/:id/edit`.
- Procurement, HR, Finance (Accounts), Assets, Projects, Inventory
- **Email Panel** (`/email`): 3-pane Gmail-style email client — Inbox, Sent, Drafts, Trash, Starred. Compose, reply, star, mark read/unread, trash. SMTP sending via nodemailer (SMTP_HOST/SMTP_USER/SMTP_PASS env vars); falls back to DB-only if not configured. "Log Received" button to manually log inbound emails. Backend: `GET/POST/PATCH/DELETE /api/emails`, `emails` table in DB.
- Notifications, Roles & Permissions, Audit Logs, Admin panels

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed database with demo data

## Authentication

- Login: `POST /api/auth/login` with `{ email, password }`
- Password hashing: SHA-256 HMAC with salt `erp_salt_2026`
- Token: JWT signed with `SESSION_SECRET` env var, 7-day expiry
- Token stored in localStorage `erp_token`, read by `setAuthTokenGetter` in `main.tsx`

### Demo Credentials
- `admin@erp.com` / `Admin@2026` — Super Admin (all companies)
- `ahmad@primemax.ae` / `Sales@2026` — Sales (Prime Max)
- `sara@primemax.ae` / `Accounts@2026` — Accounts (Prime Max)

## Modules (Frontend Pages)

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/dashboard` | KPI cards, charts, alerts |
| Leads | `/crm/leads` | Sales leads management |
| Contacts | `/crm/contacts` | Client contacts |
| Deals | `/crm/deals` | Sales deals pipeline |
| Activities | `/crm/activities` | CRM activities & tasks |
| Quotations | `/sales/quotations` | Quotations with line items |
| Proforma Invoices | `/sales/proforma-invoices` | Pre-shipment PIs |
| LPOs | `/sales/lpos` | Client purchase orders |
| Tax Invoices | `/accounts/invoices` | UAE VAT invoices |
| Delivery Notes | `/accounts/delivery-notes` | Site delivery tracking |
| Expenses | `/accounts/expenses` | Expense management |
| Cheques | `/accounts/cheques` | Cheque lifecycle tracking |
| Bank Accounts | `/accounts/bank-accounts` | Company bank details |
| Suppliers | `/procurement/suppliers` | Vendor directory |
| Purchase Requests | `/procurement/purchase-requests` | Internal PRs |
| Purchase Orders | `/procurement/purchase-orders` | POs to suppliers |
| Inventory Items | `/inventory/items` | Warehouse stock |
| Stock Entries | `/inventory/stock-entries` | Stock movements |
| Projects | `/projects` | Prefab project pipeline |
| Employees | `/hr/employees` | Staff & labour |
| Attendance | `/hr/attendance` | Daily attendance + GPS |
| Assets | `/assets` | Company asset register |
| Reports | `/reports` | Reports hub |
| Users | `/admin/users` | User management |
| Audit Logs | `/admin/audit-logs` | System audit trail |
| Notifications | `/notifications` | System notifications |

## Document Numbering

- Quotations: `PM-QTN-2026-0001`, `EP-QTN-2026-0001`
- Invoices: `PM-INV-2026-0001`, `EP-INV-2026-0001`
- Projects: `PM-PRJ-2026-0001`, `EP-PRJ-2026-0001`
- Employees: `PM-EMP-0001`, `EP-EMP-0001`

## Detail Pages

- `/procurement/purchase-orders/:id` — PO detail with edit, line items, CSV export, print, signature block
- `/accounts/cheques/:id` — Cheque detail with cheque visual, edit, CSV export, print

## Signature Feature

- Users can upload their signature on the Profile page (`/profile`)
- Signature stored as base64 data URL in `users.signature_url` column (added via migration)
- `PUT /api/users/:id/signature` — save own signature
- `document-print.tsx` `DocumentData` now accepts `preparedBySignatureUrl` — renders image above the signature line on all printed documents

## Admin Features

- `POST /api/users/:id/change-password` — admin-level password reset for any user (requires `company_admin` permission)
- Admin Users page has a key icon button (amber) per row to open ChangePasswordDialog
- `src/lib/export.ts` — `downloadCSV()` and `tableToCSV()` utilities used across list pages
- Purchase Orders list and Cheques list both have a CSV Export button

## API Routes (all under `/api`)

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/companies`, `GET /api/departments`
- `GET/POST /api/leads`, `GET/POST /api/contacts`, `GET/POST /api/deals`
- `GET/POST /api/activities`
- `GET/POST /api/quotations`, `GET/POST /api/quotations/:id/approve`
- `GET /api/proforma-invoices`, `GET /api/lpos`
- `GET/POST /api/tax-invoices`, `GET /api/delivery-notes`
- `GET/POST /api/expenses`, `GET /api/cheques`, `GET /api/bank-accounts`
- `GET/POST /api/suppliers`, `GET /api/purchase-requests`, `GET /api/purchase-orders`
- `GET/PUT /api/purchase-orders/:id`, `GET/PUT /api/cheques/:id`
- `GET/POST /api/inventory/items`, `GET/POST /api/inventory/stock-entries`
- `GET/POST /api/projects`, `GET/PUT /api/projects/:id`
- `GET/POST /api/hr/employees`, `GET /api/hr/attendance`
- `GET/POST /api/assets`
- `GET/POST /api/users`, `POST /api/users/:id/change-password`, `PUT /api/users/:id/signature`
- `GET /api/audit-logs`, `GET/PATCH /api/notifications`
- `GET /api/dashboard/summary`, `GET /api/dashboard/sales-pipeline`
- `GET /api/dashboard/pending-approvals`, `GET /api/dashboard/inventory-alerts`
- `GET /api/dashboard/recent-activity`

## Chart of Accounts — Industry Template

- `artifacts/erp-crm/src/lib/construction-coa.ts` exports `CONSTRUCTION_COA_TEMPLATE` (157 pre-defined accounts) and `CONSTRUCTION_COA_COUNT`. Codes follow industry convention: 1xxx Assets, 2xxx Liabilities, 3xxx Equity, 4xxx Revenue, 5xxx Cost of Sales / Direct Costs, 6xxx Operating & Admin Expenses. Tailored for UAE prefab manufacturing & construction services.
- Chart of Accounts page (`/accounts/chart-of-accounts`) has two action buttons:
  - **Load Industry Template** — opens a dialog to pick a target company, then bulk-creates all template accounts via sequential `useCreateChartOfAccount` mutations. Skips account codes that already exist on that company. Shows live progress (created / skipped / failed) and a final summary toast.
  - **Add Account** — existing single-account create dialog for fully customised additions on top of (or instead of) the template.
- Bulk-seed uses a separate `seedMutation = useCreateChartOfAccount()` instance with no toast handlers to avoid 100+ toast spam; one summary toast fires after the loop completes.

## Important Notes

- `lib/api-zod/src/index.ts` must only contain `export * from "./generated/api";` — codegen overwrites it
- After codegen, run `printf 'export * from "./generated/api";\n' > lib/api-zod/src/index.ts`
- The custom-fetch.ts `setAuthTokenGetter` is called in `main.tsx` to inject JWT into all requests
- `logout({})` — TanStack Query v5 mutate with empty object for no-variable mutations
