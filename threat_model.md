# Threat Model

## Project Overview

Prime Max & Elite Prefab ERP CRM is a production full-stack business system for two UAE prefab construction companies. It uses a pnpm workspace with a React/Vite frontend (`artifacts/erp-crm`), an Express 5 API (`artifacts/api-server`), PostgreSQL with Drizzle ORM (`lib/db`), JWT bearer authentication, RBAC/module permissions, company-scoped multi-tenancy, SMTP email, WhatsApp Business Cloud API integration, and base64-backed attachments/signatures.

The production security boundary is the Express API under `/api`; the React frontend is untrusted client code that stores the JWT in `localStorage` and sends it as `Authorization: Bearer`. The mockup sandbox and attached prompt assets are development-only and are out of production scope unless explicitly served by a production artifact.

## Production Scope Assumptions

- In production, `NODE_ENV` is set to `production`.
- The mockup sandbox is a development/experimental environment and is never deployed to production.
- The deployment platform terminates and manages TLS for browser-to-application traffic, including certificate renewal. Backend outbound connections to third-party services still need their own certificate validation.

## Assets

- **User accounts and sessions** -- JWTs, password hashes, permission levels, module permissions, and company access mappings. Compromise allows impersonation and privilege escalation across ERP modules.
- **Tenant business data** -- leads, contacts, deals, quotations, invoices, delivery notes, procurement records, inventory, HR records, assets, audit logs, WhatsApp conversations, and email data. Cross-company exposure would leak confidential commercial and employee information.
- **Financial and tax data** -- bank accounts, cheques, expenses, payments, journal entries, VAT reports, invoices, and payment histories. Unauthorized modification can cause fraud, compliance failures, or accounting loss.
- **External integration secrets** -- `SESSION_SECRET`/`JWT_SECRET`, database URL, SMTP credentials, WhatsApp verify/app secrets, and WhatsApp access tokens referenced by environment-variable name. These must remain server-side only and must not appear in client bundles or logs.
- **Uploaded/embedded files** -- base64 attachments, signatures, logos, and generated exports. These can carry sensitive documents and can also create denial-of-service or content-injection risk if accepted or rendered without validation.

## Trust Boundaries

- **Browser to API** -- all frontend requests are untrusted. Every non-public route must authenticate the bearer token and enforce server-side authorization; frontend `ModuleGuard` checks are usability controls only.
- **Authenticated user to company-scoped data** -- non-super-admin users are limited by `req.companyScope`. Every list/detail/mutation route touching tenant records must use `scopeFilter`, `inScope`, or an equivalent query predicate, and POST/PUT bodies must not allow assigning records to companies outside the caller's scope.
- **Regular user to admin/super-admin** -- user management, role permissions, password resets, activation/deactivation, and permission overrides must enforce both company scope and privilege-rank boundaries.
- **API to PostgreSQL** -- the backend has broad database access. Queries must remain parameterized through Drizzle builders or `sql` template literals; raw SQL string interpolation is unsafe for request-controlled values.
- **API to external services** -- SMTP/IMAP and WhatsApp Graph API calls cross into third-party systems. TLS certificate validation must remain enabled in production; webhook requests must be authenticated with the Meta HMAC signature over the raw body.
- **Unauthenticated webhook to application data** -- `/api/whatsapp/webhook` is intentionally public for Meta callbacks and must reject invalid verify tokens or invalid `X-Hub-Signature-256` values before modifying data.
- **Client-rendered exports/downloads** -- HTML/Word/PDF/CSV export paths may embed business data provided by users. Export HTML must escape untrusted fields to prevent script or markup injection in downloaded/opened documents.

## Scan Anchors

- Production API entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, and route mounting in `artifacts/api-server/src/routes/index.ts`.
- Core auth/authorization: `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/middlewares/auth.ts`, `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/routes/roles.ts`.
- Multi-tenant data routes: `routes/leads.ts`, `contacts.ts`, `deals.ts`, `activities.ts`, `quotations.ts`, `invoices.ts`, `finance.ts`, `procurement.ts`, `inventory.ts`, `assets.ts`, `hr.ts`, `projects.ts`, `sales-targets.ts`, `dashboard.ts`, `notifications.ts`.
- External and unauthenticated surfaces: `routes/whatsapp-webhook.ts`, `routes/whatsapp.ts`, `routes/emails.ts`, `routes/email-settings.ts`, `routes/ai.ts`.
- Client security-sensitive code: token handling in `artifacts/erp-crm/src/main.tsx` and `hooks/useAuth.ts`, route guards in `components/ModuleGuard.tsx` and `AdminGuard.tsx`, export helpers in `components/export-buttons.tsx` and `src/lib/export.ts`, email/profile attachment and signature flows.
- Dev-only/out-of-scope by default: `artifacts/mockup-sandbox`, `.local/skills`, `.local/state`, `attached_assets`, generated `node_modules`, and build outputs unless production reachability is demonstrated.

## Threat Categories

### Spoofing

Users authenticate with server-issued HS256 JWTs that expire after seven days. The API must validate token signatures and user active status on every protected route. Public endpoints should be limited to health checks, login/company lookup, and the WhatsApp webhook; the webhook must authenticate Meta using verify token and HMAC signature before accepting messages or statuses.

### Tampering

ERP records affect project delivery, procurement, inventory, HR, accounting, and tax workflows. The server must enforce module permissions for create/edit/approve/delete operations and must calculate or validate sensitive values server-side where applicable. Company IDs, user IDs, approval states, payment fields, and permission fields must never be trusted only because the frontend supplied them.

### Information Disclosure

Most data is tenant-confidential. List, detail, export, dashboard, email, WhatsApp, and report endpoints must only return records in the caller's company scope and must not return password hashes, secrets, hidden access-token values, raw stack traces, or unrelated tenant records. Public endpoints should reveal only intentionally public metadata.

### Denial of Service

The API accepts up to 25 MB JSON/urlencoded bodies to support base64 uploads. Upload-like fields, email attachments, signatures, generated exports, and external-service calls must validate size/type, avoid unbounded memory amplification, and use sane timeouts. Authentication endpoints and public webhook endpoints should be resistant to brute force and replay/spam.

### Elevation of Privilege

The most sensitive boundary is between normal/company-admin users and super-admin or other-company accounts. User/role/permission routes must prevent admins from assigning permissions above their rank, resetting or modifying users outside their company scope, or changing super-admin accounts unless the caller is also super-admin. All tenant data routes must apply company scoping to both reads and writes.

### Injection

Database access should use Drizzle query builders or parameterized `sql` template literals. User-controlled text used in generated HTML/Word exports, email bodies, WhatsApp messages, AI prompts, or downloaded documents must be escaped or treated as plain text. Server-side URL construction for external services must use trusted base URLs and validated account identifiers.
