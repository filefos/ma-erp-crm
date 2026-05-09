CREATE TABLE IF NOT EXISTS "deals" (
  "id" serial PRIMARY KEY NOT NULL,
  "deal_number" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "client_name" text,
  "value" double precision,
  "stage" text NOT NULL DEFAULT 'prospecting',
  "probability" double precision,
  "expected_close_date" text,
  "assigned_to_id" integer,
  "company_id" integer NOT NULL,
  "lead_id" integer,
  "notes" text,
  "created_by_id" integer,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id" serial PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "subject" text NOT NULL,
  "description" text,
  "due_date" text,
  "is_done" boolean NOT NULL DEFAULT false,
  "lead_id" integer,
  "deal_id" integer,
  "contact_id" integer,
  "company_id" integer NOT NULL,
  "created_by_id" integer,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
