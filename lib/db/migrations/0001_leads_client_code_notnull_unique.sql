-- Migration: Enforce NOT NULL + UNIQUE on leads.client_code
-- This migration was applied to the development database on 2026-05-08
-- via direct SQL execution. All rows had client_code populated already
-- (verified: 0 NULL rows). The backfill below is idempotent and safe.

BEGIN;

-- Step 1: Backfill any leads that still have NULL client_code.
-- Uses the same atomic sequence as genClientCode() in the application layer.
-- Runs per-company so codes stay scoped and don't conflict.
DO $$
DECLARE
  rec RECORD;
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
    -- Get company prefix (fallback 'PM')
    SELECT COALESCE(prefix, 'PM') INTO v_prefix
    FROM   companies WHERE id = rec.company_id;

    -- Atomically increment the per-company sequence
    INSERT INTO client_code_seqs (company_id, last_seq)
    VALUES (rec.company_id, 1)
    ON CONFLICT (company_id)
    DO UPDATE SET last_seq = client_code_seqs.last_seq + 1
    RETURNING last_seq INTO v_seq;

    v_code := upper(v_prefix) || '-CL-' || lpad(v_seq::text, 4, '0');

    UPDATE leads SET client_code = v_code WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Step 2: Enforce NOT NULL (safe — all rows now have a value)
ALTER TABLE leads ALTER COLUMN client_code SET NOT NULL;

-- Step 3: Enforce UNIQUE
ALTER TABLE leads ADD CONSTRAINT leads_client_code_unique UNIQUE (client_code);

COMMIT;
