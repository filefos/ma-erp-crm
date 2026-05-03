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
- **Projects — Salesperson, Timeline & Sales Performance** (`pages/projects/sales-performance.tsx`, `/projects/sales-performance`, nav: "Sales Performance" under Projects):
  - **Schema additions** (data-preserving, `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations in `app.ts`): `projects.salesperson_id INTEGER` and `projects.delivery_date TEXT`; new `sales_targets` table (id, company_id, user_id, period[`monthly`/`quarterly`/`yearly`], year, month, quarter, target_amount, notes, timestamps).
  - **API**: `routes/sales-targets.ts` exposes GET/POST/PUT/DELETE under `requirePermission("projects", …)` (matches the UI module guard for consistent access control), company-scoped via `scopeFilter` and `requireBodyCompanyAccess`; enriches with `userName`. `routes/projects.ts` `enrichProject` now also resolves `salespersonName`. Mounted in `routes/index.ts`.
  - **OpenAPI** (`lib/api-spec/openapi.yaml`): `Project`/`CreateProjectBody` extended with `salespersonId`, `salespersonName`, `deliveryDate`. New `SalesTarget`/`CreateSalesTargetBody` schemas and `/sales-targets` + `/sales-targets/{id}` paths. Codegen produces `useListSalesTargets`/`useCreateSalesTarget`/`useUpdateSalesTarget`/`useDeleteSalesTarget` hooks plus updated Project types.
  - **Sales Performance dashboard**: year + month/full-year filter, 4 team KPI tiles (Team Target, Achieved, Remaining + % to-go, Active Projects), Target-vs-Achieved bar chart (top 8), per-salesperson cards with avatar + status pill (exceeded/on track/behind/at risk), inline editable target (click to edit with save), Achieved (sum of `projectValue` where `salespersonId === user` and project's `startDate || createdAt` falls in the selected period) and Remaining = max(0, target − achieved); each card expands to show that salesperson's projects with Project No., Client, Location, Stage, Start, Finish, Delivery, Value. "Set Target" dialog supports monthly / quarterly / yearly periods. **Target aggregation**: when a specific month is selected the dashboard sums the matching monthly target + 1/3 of the quarterly target for that quarter + 1/12 of the yearly target; when "Full Year" is selected it sums every yearly + monthly + quarterly target for the user/year — so admins can mix granularities without the dashboard ignoring any of them. Bottom table lists all targets for the year with delete action.
  - **Projects list** (`pages/projects/index.tsx`) now shows columns: Project No., Project Name, Client, Location, Salesperson, Value, Stage, Progress, Start, Finish, Delivery; plus a "Sales Performance" header CTA, and an updated CSV/PDF export with the new fields.
  - **Project detail** (`pages/projects/detail.tsx`) gains an inline edit mode (`Edit Details` button) for Salesperson (dropdown of sales-role users), Client Name, Location, Project Value, Start Date, Finish Date, Delivery Date; KPI tiles now surface Salesperson and Delivery Date; new "Project Timeline & Assignment" card replaces the old single-row metadata strip.
- **Accounts — ULTRA PREMIUM Dashboard** (`pages/accounts/dashboard.tsx`, `/accounts` and `/accounts/dashboard`, nav: "Accounts Dashboard"): unified command center across the **three pillars** of the accounts module — (1) **Receivables** (tax invoices + payments received), (2) **Payables** (expenses + payments made + cheques), (3) **Ledger** (bank accounts + chart of accounts + journal entries). Built with the existing `components/crm/premium.tsx` UI kit. Sections:
  - `ExecutiveHeader` with action chips: + Invoice / + Payment In / + Payment Out / + Expense.
  - **AI Insights** banner (live indicator + 6 prioritized insight chips): overdue invoices (>30 days), pending cheques, pending expense approvals, estimated VAT payable (output−input), positive/negative net cash flow.
  - **8 KPI tiles** with sparklines + trend %: Total Revenue, Outstanding A/R, Cash In (30d), Cash Out (30d), Total Expenses, Pending Cheques, Bank Accounts, VAT Payable (estimate).
  - **Cash Flow 30-day AreaChart** (in vs out daily) + **Invoices by Status donut** on a navy card.
  - **Outstanding Invoices table** (oldest unpaid first, with days-open color badges: blue ≤30d / amber 31-60d / red >60d).
  - **Cheques by Status** progress bars (issued / pending / cleared / bounced / cancelled).
  - **Top Customers** (by invoiced revenue) with collected % bar; **Top Payees** (by spend, combining expenses + payments-made).
  - **Expenses by Category** donut + **Recent Transactions** timeline (mixed receipts + payments, color-coded ↓ in / ↑ out).
  - **Bank Accounts grid** (active/inactive status) + **Recent Journal Entries** (status pills: posted/approved/draft).
  - All data company-scoped via `useActiveCompany().filterByCompany()`. Outstanding-balance falls back to `grandTotal − amountPaid` when `balance` is missing. Routes use `ModuleGuard module="tax_invoices"` so the same permission as the existing accounts pages applies. `CATEGORY_HOMES.accounts` updated to `/accounts` so the breadcrumb home for the Accounts category is the new dashboard instead of the invoices list.
  - **Performance + correctness**: the 30-day cash flow chart pre-groups payments into Maps keyed by **local-timezone day** (so a Dubai-time payment dated `2024-05-01` correctly buckets on May 1, not Apr 30 UTC), then the 30-iteration loop is an O(1) map lookup per day → O(N+30) overall instead of O(N×30) nested filter.
  - **HIGH ALERT — Cheques due soon banner** (renders only when relevant): pulsing red banner placed at the very top of the dashboard (above AI Insights). Filters `pendingCheques` (status not in `cleared/cancelled/bounced`) for those whose `chequeDate` falls within the next 7 days, sorted ascending. Each card shows **payee name** (the "issued to whom"), cheque number, bank, date, amount, and an urgency pill: `OVERDUE Nd` (red), `DUE TODAY` (red, animated pulse), `≤2d left` (amber), or `Nd left` (light amber). Header summarizes total cheques + total value + count past date, with a CTA to `/accounts/cheques`. Also surfaces the same condition as the first AI Insight chip.
  - **Delivery Notes integration**: adds a 9th data hook (`useListDeliveryNotes`), a "+ Delivery Note" header action (5th chip alongside +Invoice/+Payment In/+Payment Out/+Expense), a **Delivery Notes** KPI tile (replaces the standalone Bank Accounts tile in slot 7 — bank info is preserved in the Bank Accounts grid below) showing total + pending count + 8-week sparkline + trend %, and a **Recent Delivery Notes** card in the bottom row (6 most recent by `deliveryDate ?? createdAt`, with capitalized status pills color-coded for delivered/in_transit/dispatched/cancelled). The bottom row is now a 3-col grid: **Bank Accounts | Recent Delivery Notes | Recent Journal Entries**.
  - **UAE FTA Tax Compliance card** (new full-row 2-col section, after Outstanding Invoices + Cheques row):
    - **VAT (5%)** card (`tone="blue"`, `ShieldCheck` icon) — three sub-tiles: **Output VAT** (collected on sales = `Σ invoice.vatAmount`), **Input VAT** (recoverable on costs = `Σ expense.vatAmount`), **Net Payable / Refundable** (output−input, color-coded amber if owed to FTA / emerald if refundable). Footer notes the standard 5% rate, quarterly EmaraTax filing, and total taxable supplies (subtotal excl. VAT).
    - **Corporate Tax (9%)** card (`tone="purple"`, `Calculator` icon) — four sub-tiles: **Taxable Income** (`Σ invoice.subtotal − Σ (expense.total − expense.vatAmount)`, both net of VAT), **Threshold** (AED 375,000 — 0% small-business relief band), **Above Threshold** (subject to 9% CT), **CT Estimated** (`max(0, (taxableProfit − 375,000) × 0.09)`, color-coded purple if owed / emerald if below threshold). Marked "ESTIMATE" pill, with footer reference to **Federal Decree-Law No. 47 of 2022** effective for financial years starting on or after 1 June 2023.
  - **Global amber/yellow → orange palette swap** (May 2026, 57 files): the user reported yellow/amber text was washing out and hard to read on every dashboard. Swapped the entire `amber-*` and `yellow-*` Tailwind color tokens to `orange-*` across the whole erp-crm app (`text-`, `bg-`, `border-`, `fill-`, `from-`, `to-`, `via-`, `ring-`, `dark:` variants — all swapped). Inline hex chart colors also remapped: `#f59e0b` (amber-500) and `#eab308` (yellow-500) → `#f97316` (orange-500); `#fbbf24/facc15` → `#fb923c`; `#d97706` → `#ea580c`; light-tone backgrounds `#fef3c7/fef9c3` → `#ffedd5`, etc. This affects every status badge that previously used amber (pending, partial, half-day, warm leads, expired quotes, in-progress procurement, etc.), all "warning" callouts, the FTA VAT-Payable card, the Cheques Due Soon banner urgency pills, and chart palettes (Recharts color arrays in business/inventory/accounts/CRM dashboards). Orange has substantially higher perceived contrast on white backgrounds and reads as a distinct hue (not "yellow"), preserving the warning/pending semantic without the readability problem. HMR refreshed all 57 files clean with zero errors.
  - **Cheques by Status readability fix**: the indigo card had `text-[11px]` labels with `text-muted-foreground` values that washed out on the tinted background. Now uses a clean white `PremiumCard` (no tone tint) with `text-xs font-bold text-foreground` for status names + colored swatch indicator, `text-foreground` (full-contrast) for value figures, taller `h-2.5` progress bars on a `bg-foreground/10` track, and a header CTA linking to `/accounts/cheques`.
- **Module Dashboards — Premium Suite (Task #2, May 2026)** — full set of executive dashboards across every major segment, all reusing `components/crm/premium.tsx` and company-scoped via `useActiveCompany().filterByCompany()`. Pure read-only frontend; no schema or API changes:
  - **Main Executive Dashboard** (`pages/main-dashboard.tsx`, mounted at `/` via `pages/dashboard.tsx`): cross-module landing page. `ExecutiveHeader` w/ greeting + role pill + "Add Lead/Quotation/Invoice/Project" chips, alerts banner (overdue invoices / pending approvals / low stock / cheques due 7d), 8 cross-module KPIs (Revenue YTD, Outstanding A/R, Won Deals MTD, Pipeline AED, Active Projects, Pending Approvals, Low Stock, Active Employees), 12-month Revenue/Expense/Net Profit AreaChart, Cash-In vs Cash-Out 30d donut, Sales Funnel (leads→deals→quotations→invoices→won), Top 5 Clients by revenue, and an 8-tile **Segment Shortcut Grid** (CRM/Sales/Accounts/Inventory/Procurement/Projects/HR/Assets/Email/Reports) each linking to its segment dashboard.
  - **Sales Dashboard** (`pages/sales/dashboard.tsx`, `/sales/dashboard`, `/sales`): 8 KPIs (Total Quoted, Open PIs, Tax Invoices, Outstanding A/R, Conversion %, Avg Deal Size, Won This Month, LPOs Received), monthly Quoted-vs-Invoiced AreaChart, Quotation-status donut, Top Salespeople bar, recent quotations table.
  - **Projects Dashboard** (`pages/projects/dashboard.tsx`, `/projects/dashboard`): 8 KPIs (Active, In Production, On Site, Delayed, Total Project Value, Avg Project Size, Delivered MTD, Pending Delivery), Stage-mix donut, Production-status pie, Top Salespeople bar, upcoming deliveries strip (next 14 days).
  - **HR Dashboard** (`pages/hr/dashboard.tsx`, `/hr/dashboard`, `/hr`): 8 KPIs (Total Employees, Active, On Leave, Today Present/Absent/Late, Attendance %, Sales-role count), 30-day attendance AreaChart (present/late/absent), Department donut, Status donut, recent joiners list.
  - **Assets Dashboard** (`pages/assets/dashboard.tsx`, `/assets/dashboard`): 6 KPIs (Total Assets, Active, Under Maintenance, Disposed, Total Asset Value, Avg Value), Type donut, Status donut, Top assets by value.
  - **Email Dashboard** (`pages/email/dashboard.tsx`, `/email/dashboard`): 6 KPIs (Inbox, Unread, Sent, Drafts, Starred, Trash), Folder distribution donut, recent inbox + recent sent strips.
  - **Reports Dashboard** (`pages/reports/dashboard.tsx`, `/reports/dashboard`): cross-module analytics overview — Reporting Highlights strip (Deals value / Outstanding A/R / Won deals MTD), 8 KPIs (Revenue, Quoted, Procurement Spend, Expenses, Active Projects, Inventory Value, Attendance Today, POs Open), 12-month Revenue-vs-Expense-vs-PO chart, Quotation-status donut.
  - **Wiring**: `App.tsx` registers each route under the appropriate `ModuleGuard` (tax_invoices / projects / employees / assets / emails / reports), wouter `<Route>`s use the children pattern where the page accepts no props. `components/layout.tsx` `NAV` adds a "Sales/Projects/HR/Assets/Email/Reports Dashboard" entry at the top of each respective group; `CATEGORY_HOMES` updated so breadcrumbs land on the new dashboard for each category. `pages/dashboard.tsx` now delegates to `MainExecutiveDashboard`.
- **Inventory — ULTRA PREMIUM Dashboard** (`pages/inventory/dashboard.tsx`, `/inventory` and `/inventory/dashboard`, nav: "Inventory Dashboard"): unified command center across the **three pillars** of the inventory module — (1) **inventory tracking** (items + stock movements), (2) **purchase orders** (procurement side), (3) **sales orders / LPOs** (customer side). Built with the existing `components/crm/premium.tsx` UI kit. Sections:
  - `ExecutiveHeader` with embedded action chips: + Item / + Stock Entry / + PO / + LPO.
  - **AI Inventory Insights** banner (live indicator) — tone-coloured cards for out-of-stock, low-stock, stale POs (>14 days), no open POs warning, and active sales-order pipeline summary.
  - **8 KPI widgets** with sparklines + trend pills: Total Items, Stock Value (AED), Low Stock, Out of Stock, Open POs, PO Value Pending, Active Sales Orders, Sales Order Value (AED).
  - **Stock Movements — Last 30 Days** dual-area chart (stock-in vs stock-out) using daily buckets.
  - **Stock Value by Category** donut on a navy gradient card with top-5 legend list.
  - **Reorder Alerts** grid showing OUT and LOW items with computed reorder quantity (`max(min*2 - current, min)`) and Create-PO CTA.
  - **PO by Status** donut + breakdown list and **Sales Orders (LPO) by Status** stacked progress bars side-by-side.
  - **Top Suppliers** (by PO value) and **Top Clients** (by LPO value) progress-bar leaderboards with avatars.
  - **Recent Stock Movements** timeline (last 8) with in/out/adjustment icons, signed quantity, approval status.
  - All sections company-scoped via `useActiveCompany().filterByCompany()`. Pure read-only; no API/schema changes. Routes `/inventory` and `/inventory/dashboard` registered in `App.tsx` under `<ModuleGuard module="inventory_items">`. Sidebar Inventory group reordered to put "Inventory Dashboard" first; `CATEGORY_HOMES.inventory` now points to `/inventory`.
- **CRM — ULTRA PREMIUM (Phase 3)** — Salesforce/Zoho-grade visual polish across the CRM, frontend-only (no API or schema changes; existing data preserved):
  - **Premium UI kit** (`components/crm/premium.tsx`): `ExecutiveHeader` (gradient navy→blue header w/ icon + slot for action chips), `KPIWidget` (gradient card w/ icon, value, sub, trend pill, optional inline `Sparkline` SVG), `Sparkline`, `PremiumCard`, `StatusBadge` (status-coloured pill w/ dot), `PriorityBadge`, `AIScoreBadge` (gradient hot/warm/cold), `Avatar` (initials w/ stable HSL gradient + ring), plus helpers `weeklyCounts` / `weeklyValues` / `trendPct`.
  - **CRM Command Center** rewritten with `ExecutiveHeader`, 8 `KPIWidget`s with sparklines + 4-week vs 4-week trend %, refined AI Insights banner (left navy gradient stripe, live badge), `Avatar` + `AIScoreBadge` on hot-leads strip, `StatusBadge` on AI Suggested cards.
  - **CRM Reports** (`pages/crm/reports.tsx`, `/crm/reports`, nav: "CRM Reports"): 8 KPIs (won revenue, open pipeline, win rate, avg deal size, conversion, quotation value, total deals, hot leads), custom **Conversion Funnel** (5 stages w/ % drop-off bars), **Lead Source Mix** donut, **Win/Loss Ratio** donut, **Sales by Salesperson** stacked horizontal bar (Won + Pipeline AED), **Revenue Trend** 6-month line (Won vs. Pipeline). Wired in `App.tsx` under `<ModuleGuard module="leads">`.
  - **Leads** polished: `ExecutiveHeader` w/ embedded Add/Import/Export, KPI stat cards swapped for `KPIWidget`, table rows now show `Avatar` next to name, `AIScoreBadge` for score, `StatusBadge` for status, and a row-hover quick-action toolbar (Call / WhatsApp / Email / Open lead) that fades in on `group-hover`.
  - **Sales Pipeline** polished: `ExecutiveHeader` w/ stat chips embedded, deal cards upgraded to rounded-xl w/ `hover:-translate-y-0.5` lift, salesperson `Avatar` (size 20) at top-right, deal-number + stuck warning, value + colour-coded probability bar (green ≥70 / amber ≥40 / slate else) + % label.
  - **Routing/Nav**: `App.tsx` adds `CRMReports` route at `/crm/reports`. `components/layout.tsx` adds "CRM Reports" nav item (icon: BarChart) under CRM group.
- **Pro CRM (Phase 1)** — `/crm` is the **CRM Command Center** (`pages/crm/dashboard.tsx`): 8 KPI cards (total/new/hot leads, active/won deals, follow-ups today, overdue, quotation value, conversion%), Recharts pie (sources) + bar (pipeline by stage with deals/value), AI Suggested Actions card (top 3 from overdue → today → hot), follow-ups list with WhatsApp/phone quick links, recent activity timeline, top hot leads strip, footer stats. The old `hub.tsx` was replaced.
  - **Sales Pipeline Kanban** (`/crm/pipeline`, `pages/crm/pipeline.tsx`): drag-and-drop deals across 6 stages (new → qualification → proposal → negotiation → won/lost) using HTML5 native DnD; per-stage value totals; on drop calls `useUpdateDeal` and invalidates `getListDealsQueryKey`. No schema changes — stage values match existing `dealsTable.stage`.
  - **AI helpers** (`src/lib/ai-crm.ts`): pure heuristic functions — `scoreLead` (0-100 + hot/warm/cold + reasons), `suggestNextAction`, `generateFollowUpMessage`, `generateWhatsAppMessage`, `summarizeClient`, `findDuplicates`. Stable signatures so they can be swapped for an LLM (OpenAI/Anthropic via Replit AI integrations) without changing callers.
  - **Lead Detail upgrade** (`pages/crm/lead-detail.tsx`): AI score chip in header; **Convert to Deal** button (creates deal in `qualification` stage with prefilled title/value/probability via `useCreateDeal`, navigates to `/crm/deals`); Tabs for **Activity Timeline** (vertical ordered list, mark-done toggle, inline Add Activity dialog using `useCreateActivity`/`useUpdateActivity`) and **AI Assistant** (score card with reasons, next-best-action, draft Email/WhatsApp/Summary dialogs with copy-to-clipboard, "Apply AI score" button).
  - **Bulk actions on Leads** (`pages/crm/leads.tsx`): checkbox column + select-all; bulk toolbar appears when >0 selected with Status/Score selects + Archive button (sets `isActive=false`) running mutations in parallel via `useUpdateLead`; colSpan bumped 8→9.
  - **Routing/Nav**: `App.tsx` imports `CRMDashboard` and `SalesPipeline`; sidebar `NAV` adds "CRM Dashboard" and "Sales Pipeline" entries at top of CRM group; `ROUTE_LABELS.pipeline = "Sales Pipeline"`. `CATEGORY_HOMES.crm` continues to point at `/crm`.
- Sales: Quotations (with revision bump R00→R01), Proforma Invoices, Delivery Notes, Invoices
  - **Payment-term-driven invoice generator** (`src/lib/payment-terms.ts`): 6 presets (100% advance, 75/25, 50/50, 25/75, 25/50/25, 25/25/25/25); parser for free-form payment-terms text. Quotation new/edit pages have a preset dropdown that fills the payment-terms input. Quotation detail's "Convert" action opens a dialog showing parsed installments (editable label/% + add/remove + per-row select), then sequentially creates one Proforma or Tax Invoice per selected installment with proportional subtotal/VAT/total. Per-installment try/catch keeps the loop going on errors. List query keys are invalidated after creation. Calculator absorbs cent-rounding drift into the final installment.
  - **Editable invoices**: `proforma-invoice-edit.tsx` and `accounts/invoice-edit.tsx` allow full edit of client info, dates, totals, VAT %, status, payment terms, and pass extra (non-OpenAPI) fields like `vatPercent`, `clientTrn`, `amountPaid`, contact/location/notes via cast spread — server persists them via `...rest` spread. Routes: `/sales/proforma-invoices/:id/edit`, `/accounts/invoices/:id/edit`.
- Procurement, HR, Finance (Accounts), Assets, Projects, Inventory
- **WhatsApp Inbox (Phase 1 Cloud API)** (`/crm/whatsapp`, `pages/crm/whatsapp.tsx`) — two-way Outlook-style inbox with thread list (search + filter by lead/deal/contact/project/unlinked), conversation pane with read receipts (queued/sent/delivered/read/failed status icons), templates tab (lists Meta-approved templates from `GET /whatsapp/templates`, with variable picker dialog to send), and settings tab to register WhatsApp Cloud API accounts (phone_number_id, waba_id, access_token_env, isDefault). Backend: `routes/whatsapp.ts` (accounts CRUD, threads list/get/update/mark-read, messages list, `POST /whatsapp/send` proxying to graph.facebook.com Cloud API, templates proxy, link-search) gated by RBAC `whatsapp` module + scopeFilter; `routes/whatsapp-webhook.ts` (`GET/POST /whatsapp/webhook` — handshake via `WHATSAPP_VERIFY_TOKEN` env, HMAC-SHA256 verification of `X-Hub-Signature-256` against `WHATSAPP_APP_SECRET` env using raw request body, ingests messages/statuses with waMessageId de-dup, auto-creates a Lead for unknown senders). DB: `whatsapp_accounts` / `whatsapp_threads` / `whatsapp_messages` (`lib/db/src/schema/whatsapp.ts`, idempotent CREATE TABLEs in `app.ts`). `WhatsAppButton` now prefers the Cloud API path when an active account exists with its access-token env var set, and falls back to wa.me otherwise. Tokens are read from env vars only (never stored in DB). New `whatsapp` module added to `MODULES` in `scripts/src/seed.ts` so RBAC permissions seed for it.

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

### Task #2 — Ultra-premium dashboard suite (final, May 2026)

Final shipped behavior (supersedes any earlier descriptions in this file):

- **Routing**: `/` and `/dashboard` render the executive `MainDashboard`. Each module has a dashboard route guarded by its module key:
  - `/sales` (`quotations`), `/projects/dashboard` (`projects`), `/hr` & `/hr/dashboard` (`employees`), `/assets/dashboard` (`assets`), `/reports/dashboard` & `/reports` (`dashboard`), `/procurement/dashboard` (`purchase_orders`), `/email` & `/email/dashboard` (`emails`).
  - `/projects` and `/assets` retain their list views; `/projects/dashboard` and `/assets/dashboard` are the analytics surfaces.
- **Main Executive Dashboard** (`pages/main-dashboard.tsx`):
  - Permission-gates every list query via `usePermissions().can(...)` and the matching `enabled` flag, so the dashboard never fetches data the user cannot see.
  - Company-scopes everything via `useActiveCompany().filterByCompany(...)`. Attendance is scoped by in-company employee IDs when the row lacks a `companyId`, preventing cross-company leakage.
  - Primary KPI strip: Revenue MTD, Expenses MTD, Quotations Value, Open Pipeline, Leads · 30d, Open POs, Active Projects, Active Workforce, Low Stock — each gated by its `can*` flag.
  - Top Clients (highest payments received) and Top Payees (largest vendor outflow from `expenses`) are now distinct panels.
  - Segment-shortcut grid uses the same module keys as the corresponding routes (Email → `can("emails")`, Reports → `can("dashboard")`, HR → `canEmployees`).
- **Sales Dashboard** primary KPI strip (8 cards): Open Quotations · Quotation Value · Proforma Pending · Conversion Rate · Win Rate · LPOs MTD · Top Salesperson · Top Customer. Sales Leaderboard rows include a 6-month "won AED" sparkline derived from the user's deals.
- **Projects Dashboard** includes Upcoming Handovers (next 30 days, color-coded by urgency) and Revenue by Project (top 8, horizontal bar with invoiced overlay).
- **Email Dashboard** volume series is 14 days, matching the panel label.
- **Reports & Procurement Dashboards** no longer call `useGetDashboardSummary()` / `useGetProcurementDashboard()`. All figures derive from already company-filtered lists, eliminating cross-tenant leakage and zero-count clobbering from the previous `computed || summary` fallback.
- **Sidebar nav** (`components/layout.tsx`): `visibleGroupsFor(user, canEmails)` filters by department/role mapping AND drops the Email group when `can("emails")` is false, keeping nav and route guards consistent.

## Important Notes

- `lib/api-zod/src/index.ts` must only contain `export * from "./generated/api";` — codegen overwrites it
- After codegen, run `printf 'export * from "./generated/api";\n' > lib/api-zod/src/index.ts`
- The custom-fetch.ts `setAuthTokenGetter` is called in `main.tsx` to inject JWT into all requests
- `logout({})` — TanStack Query v5 mutate with empty object for no-variable mutations
