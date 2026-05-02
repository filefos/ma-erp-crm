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
- **Pro CRM (Phase 1)** — `/crm` is now the **CRM Command Center** (`pages/crm/dashboard.tsx`): 8 KPI cards (total/new/hot leads, active/won deals, follow-ups today, overdue, quotation value, conversion%), Recharts pie (sources) + bar (pipeline by stage with deals/value), AI Suggested Actions card (top 3 from overdue → today → hot), follow-ups list with WhatsApp/phone quick links, recent activity timeline, top hot leads strip, footer stats. The old `hub.tsx` was replaced.
  - **Sales Pipeline Kanban** (`/crm/pipeline`, `pages/crm/pipeline.tsx`): drag-and-drop deals across 6 stages (new → qualification → proposal → negotiation → won/lost) using HTML5 native DnD; per-stage value totals; on drop calls `useUpdateDeal` and invalidates `getListDealsQueryKey`. No schema changes — stage values match existing `dealsTable.stage`.
  - **AI helpers** (`src/lib/ai-crm.ts`): pure heuristic functions — `scoreLead` (0-100 + hot/warm/cold + reasons), `suggestNextAction`, `generateFollowUpMessage`, `generateWhatsAppMessage`, `summarizeClient`, `findDuplicates`. Stable signatures so they can be swapped for an LLM (OpenAI/Anthropic via Replit AI integrations) without changing callers.
  - **Lead Detail upgrade** (`pages/crm/lead-detail.tsx`): AI score chip in header; **Convert to Deal** button (creates deal in `qualification` stage with prefilled title/value/probability via `useCreateDeal`, navigates to `/crm/deals`); Tabs for **Activity Timeline** (vertical ordered list, mark-done toggle, inline Add Activity dialog using `useCreateActivity`/`useUpdateActivity`) and **AI Assistant** (score card with reasons, next-best-action, draft Email/WhatsApp/Summary dialogs with copy-to-clipboard, "Apply AI score" button).
  - **Bulk actions on Leads** (`pages/crm/leads.tsx`): checkbox column + select-all; bulk toolbar appears when >0 selected with Status/Score selects + Archive button (sets `isActive=false`) running mutations in parallel via `useUpdateLead`; colSpan bumped 8→9.
  - **Routing/Nav**: `App.tsx` imports `CRMDashboard` and `SalesPipeline`; sidebar `NAV` adds "CRM Dashboard" and "Sales Pipeline" entries at top of CRM group; `ROUTE_LABELS.pipeline = "Sales Pipeline"`. `CATEGORY_HOMES.crm` continues to point at `/crm`.
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

## CRM — Executive Upgrade (Phase 2)

The Sales/CRM module is being elevated to a "World-Class Executive CRM". Phase-2 deliverables (frontend-only; no schema changes):

- **Follow-up Center** (`/crm/follow-ups`, `pages/crm/follow-ups.tsx`) — unified view of lead `nextFollowUp` and activity due-dates with Today / Overdue / Week / All tabs. Reschedule dialog (pre-fills with current date), Done action, plus inline call / WhatsApp / email shortcuts.
- **Sales Leaderboard** (`/crm/leaderboard`, `pages/crm/leaderboard.tsx`) — ranks sales-role users by composite score (won AED + deal counts + activities + conversion %). Conversion only counts when a rep has ≥5 leads to avoid low-volume outliers. Includes top-performer card and Recharts Won-vs-Pipeline bar chart.
- **CSV Lead Import** (`components/crm/LeadCsvImport.tsx`) — template download, custom CSV parser (BOM-stripping, quoted commas, escaped quotes, embedded newlines), live progress, batched `useCreateLead` calls. Mounted from Leads page "Import CSV" button.
- **Bulk Assign-To** on Leads — dropdown of sales-role users (filtered via `useListUsers`) for assigning multiple leads at once.
- **Stuck-Deal Detection** on Pipeline — deals not updated in 7+ days get an amber ring + AlertTriangle, plus a stat tile and banner with the count.
- **AI Executive Insights** banner on the CRM Dashboard — gradient strip surfacing: uncontacted hot leads (3+ days), overdue follow-ups, stuck deals (7+ days), high-value (≥AED 500k) deals at risk.
- **AI Assistant additions** on Lead Detail — `predictDealSuccess` (probability + rationale), `analyzeLostDeal` (post-mortem, only when status=lost), `improveNotes` (rewrites notes professionally). Heuristic implementations live in `lib/ai-crm.ts`; signatures are stable so they can be swapped to an LLM-backed implementation later via the AI integrations skill.
- **Navigation** — `components/layout.tsx` has new entries (Follow-up Center, Sales Leaderboard) under the CRM group.

Deferred to a later phase (require backend/schema work): dedicated CRM Reports page, "Approved" deal stage, attachments / tags / priority / quantity fields, automation-rule engine, monthly sales targets table, deeper RBAC scoping (sales sees only own).

## Important Notes

- `lib/api-zod/src/index.ts` must only contain `export * from "./generated/api";` — codegen overwrites it
- After codegen, run `printf 'export * from "./generated/api";\n' > lib/api-zod/src/index.ts`
- The custom-fetch.ts `setAuthTokenGetter` is called in `main.tsx` to inject JWT into all requests
- `logout({})` — TanStack Query v5 mutate with empty object for no-variable mutations
