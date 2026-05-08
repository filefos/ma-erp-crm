-- Migration: Enforce NOT NULL + UNIQUE on leads.client_code
-- Applied: 2026-05-08 via executeSql (already applied to the database)
--
-- All existing leads already had client_code populated by the backend's
-- genClientCode() before this constraint was added (verified: 0 NULL rows).
--
-- Step 1: Backfill any remaining NULLs (none existed, but included for safety)
-- UPDATE leads SET client_code = (
--   SELECT prefix || '-CL-' || LPAD(nextval('client_code_seq_' || company_id::text)::text, 4, '0')
--   FROM companies WHERE id = leads.company_id
-- ) WHERE client_code IS NULL;
--
-- Step 2: Enforce NOT NULL
ALTER TABLE leads ALTER COLUMN client_code SET NOT NULL;
--
-- Step 3: Enforce UNIQUE
ALTER TABLE leads ADD CONSTRAINT leads_client_code_unique UNIQUE (client_code);
