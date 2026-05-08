-- Migration: Enforce NOT NULL + UNIQUE on leads.client_code
-- This migration was applied to the development database on 2026-05-08
-- via direct SQL execution. All rows had client_code populated already
-- (verified: 0 NULL rows). The backfill below is idempotent and safe.

BEGIN;

-- Step 1: Backfill any leads that still have NULL client_code.
-- Uses the same atomic sequence as genClientCode() in the application layer.
-- Runs per-company so codes stay scoped and don't conflict.
-- Rows with a NULL company_id are skipped with a NOTICE rather than producing
-- a NULL client_code that would violate the NOT NULL constraint below.
DO $$
DECLARE
  rec      RECORD;
  v_prefix TEXT;
  v_seq    BIGINT;
  v_code   TEXT;
BEGIN
  FOR rec IN
    SELECT l.id, l.company_id
    FROM   leads l
    WHERE  l.client_code IS NULL
    ORDER  BY l.id
  LOOP
    -- Guard: skip rows that have no company_id — they cannot be assigned a
    -- company-scoped code and must be resolved manually before this migration
    -- can enforce NOT NULL.
    IF rec.company_id IS NULL THEN
      RAISE NOTICE 'Lead id=% has NULL company_id — skipping backfill. '
                   'Assign a company before re-running the NOT NULL step.',
                   rec.id;
      CONTINUE;
    END IF;

    -- Get company prefix; fall back to ''PM'' when prefix column is NULL.
    SELECT COALESCE(NULLIF(TRIM(prefix), ''), 'PM') INTO v_prefix
    FROM   companies WHERE id = rec.company_id;

    -- Safety net: if the company row is missing entirely, default to ''XX''.
    IF v_prefix IS NULL THEN
      v_prefix := 'XX';
    END IF;

    -- Atomically increment the per-company sequence.
    INSERT INTO client_code_seqs (company_id, last_seq)
    VALUES (rec.company_id, 1)
    ON CONFLICT (company_id)
    DO UPDATE SET last_seq = client_code_seqs.last_seq + 1
    RETURNING last_seq INTO v_seq;

    v_code := upper(v_prefix) || '-CL-' || lpad(v_seq::text, 4, '0');

    UPDATE leads SET client_code = v_code WHERE id = rec.id;
  END LOOP;

  -- Fail fast if any rows were skipped (still NULL) — prevents a misleading
  -- NOT NULL constraint error later in the migration.
  IF EXISTS (SELECT 1 FROM leads WHERE client_code IS NULL) THEN
    RAISE EXCEPTION
      'Cannot enforce NOT NULL on leads.client_code: % row(s) still have a '
      'NULL value after backfill. Fix company_id on those rows first.',
      (SELECT COUNT(*) FROM leads WHERE client_code IS NULL);
  END IF;
END;
$$;

-- Step 2: Enforce NOT NULL (safe — all rows now have a value)
ALTER TABLE leads ALTER COLUMN client_code SET NOT NULL;

-- Step 3: Enforce UNIQUE
ALTER TABLE leads ADD CONSTRAINT leads_client_code_unique UNIQUE (client_code);

COMMIT;
