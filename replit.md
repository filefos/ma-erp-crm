# Prime Max & Elite Prefab ERP CRM

Full-stack ERP + CRM system for UAE prefab construction companies Prime Max Prefab Houses Industry LLC and Elite Pre-Fabricated Houses Trading Co. LLC.

## Run & Operate

- `pnpm run typecheck`: Run full typecheck.
- `pnpm run build`: Typecheck and build all packages.
- `pnpm --filter @workspace/api-spec run codegen`: Regenerate API hooks and Zod schemas from OpenAPI spec.
- `pnpm --filter @workspace/db run push`: Push DB schema changes (development only).
- `pnpm --filter @workspace/scripts run seed`: Seed database with demo data.

**Required Environment Variables:**
- `SESSION_SECRET`: For JWT signing.
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`: For WhatsApp Cloud API webhook verification.
- `EXPO_PUBLIC_DOMAIN`: Base URL for mobile app API calls.
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`: For email sending (optional, falls back to DB-only).
- `EXPO_ACCESS_TOKEN`: For Expo push notifications (optional).

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **Package Manager**: pnpm
- **TypeScript**: 5.9
- **Frontend**: React + Vite
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Auth**: JWT (stored in localStorage `erp_token`, `Authorization: Bearer` header)
- **Charts**: Recharts

## Where things live

- **Frontend App**: `artifacts/erp-crm` (port 24746)
- **Backend API**: `artifacts/api-server` (port 8080)
- **Mobile App**: `artifacts/mobile` (Expo Router app, port 18115)
- **OpenAPI Spec**: `lib/api-spec/openapi.yaml` (source of truth for API contracts)
- **DB Schema**: `lib/db/src/schema/` (contains Drizzle schemas)
- **AI Helpers (CRM)**: `src/lib/ai-crm.ts`
- **Payment Terms Logic**: `src/lib/payment-terms.ts`
- **Company Branding**: `src/config/branding.ts` (for brand colors, logos, etc.)
- **Construction Chart of Accounts Template**: `artifacts/erp-crm/src/lib/construction-coa.ts`
- **Global Email Compose**: `artifacts/erp-crm/src/contexts/email-compose-context.tsx` (context) + `artifacts/erp-crm/src/components/email-compose-modal.tsx` (modal)

## Architecture decisions

- **Monorepo Structure**: Uses pnpm workspaces to manage multiple packages (frontend, backend, mobile, shared libraries) for better code sharing and dependency management.
- **API Design**: All API routes are under `/api`. Authentication uses JWTs stored in local storage/SecureStore. Most endpoints enforce RBAC and company-level scoping.
- **Frontend Modularity**: Module-specific dashboards and features are implemented as separate pages and components, guarded by `ModuleGuard` for role-based access control.
- **Hybrid AI Approach**: AI features (e.g., lead scoring, follow-up suggestions) are initially heuristic functions (`lib/ai-crm.ts`) with stable signatures, designed to be swappable with LLM-backed implementations in the future without affecting calling code.
- **Push Notification System**: Expo push tokens are managed server-side, enabling targeted push notifications for critical events like approvals, overdue invoices, and low stock, with deep-linking functionality.
- **UI Theming**: A global color palette swap (amber/yellow to orange) was performed for improved contrast and readability across all dashboards, indicating a preference for accessibility in design.

## Product

- **Comprehensive ERP/CRM**: Manages sales, CRM, accounts, procurement, HR, inventory, assets, and projects.
- **Module Dashboards**: Executive, Sales, Projects, HR, Assets, Email, Reports, Inventory, CRM dashboards provide role-specific KPIs, charts, and quick actions.
- **Advanced CRM**: Features lead management, sales pipeline kanban with drag-and-drop, AI-powered lead scoring and action suggestions, bulk actions, and follow-up management.
- **Financial Compliance**: Includes UAE FTA tax compliance features (VAT and Corporate Tax estimation), payment-term-driven invoice generation, and VAT-compliant PDF invoicing.
- **Communication Integration**: Two-way WhatsApp inbox integration with Cloud API, email panel, and push notifications for key events.
- **Global Email Compose**: Outlook-style floating compose modal (minimize/maximize/normal) accessible from any document. "Send Email" button on Quotation, Proforma, Tax Invoice, Delivery Note, Undertaking Letter, and Handover Note detail pages. Built-in Client Document Explorer searches all 7 document types by client/reference and one-click attaches references. Sends via SMTP using `/api/emails`.
- **Document Management**: Supports document numbering, signature upload, and PDF generation for various documents (quotations, invoices, POs).
- **Mobile Access**: Companion Expo mobile app with role-based dashboards and features, reusing web components where possible.

## User preferences

- _Populate as you build_

## Gotchas

- After running `pnpm --filter @workspace/api-spec run codegen`, ensure `lib/api-zod/src/index.ts` only contains `export * from "./generated/api";` as codegen overwrites this file.
- Changes to `drizzle/schema.ts` require running `pnpm --filter @workspace/db run push` to apply database schema updates (dev only).
- When using TanStack Query `mutate` for no-variable mutations, pass an empty object: `logout({})`.
- When adding new modules, ensure they are added to `MODULES` in `scripts/src/seed.ts` for proper RBAC permission seeding.

## Pointers

- **RBAC & Permissions**: `src/lib/auth.ts` and `components/ModuleGuard.tsx`.
- **Drizzle ORM**: [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- **TanStack Query**: [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- **OpenAPI Specification**: [OpenAPI Initiative](https://www.openapis.org/)
- **Expo Push Notifications**: [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- **UAE Federal Decree-Law No. 47 of 2022**: For Corporate Tax regulations.