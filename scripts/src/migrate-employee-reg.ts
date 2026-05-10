import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_registrations (
      id serial PRIMARY KEY,
      reg_code text NOT NULL UNIQUE,
      dept_reg_code text,
      token text NOT NULL UNIQUE,
      link_active boolean NOT NULL DEFAULT true,
      company_id integer NOT NULL,
      department_id integer,
      department_name text,
      status text NOT NULL DEFAULT 'link_generated',
      full_name text NOT NULL,
      email text,
      mobile text,
      designation text,
      joining_type text,
      branch text,
      father_name text,
      date_of_birth text,
      gender text,
      nationality text,
      marital_status text,
      current_address text,
      permanent_address text,
      current_country text,
      current_state text,
      current_city text,
      home_country text,
      home_state text,
      home_city text,
      emergency_contact_name text,
      emergency_contact_number text,
      emergency_contact_relationship text,
      expected_joining_date text,
      visa_status text,
      uae_driving_license text,
      total_experience_years text,
      gulf_experience_years text,
      home_country_experience_years text,
      previous_company text,
      previous_designation text,
      previous_company_location text,
      reason_for_leaving text,
      skills_category text,
      salary_expectation text,
      admin_remarks text,
      correction_notes text,
      submitted_at timestamp,
      reviewed_at timestamp,
      approved_at timestamp,
      created_by_id integer,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_reg_documents (
      id serial PRIMARY KEY,
      registration_id integer NOT NULL,
      document_type text NOT NULL,
      document_name text NOT NULL,
      file_data text,
      file_name text,
      content_type text,
      file_size_bytes integer,
      expiry_date text,
      status text NOT NULL DEFAULT 'submitted',
      required boolean NOT NULL DEFAULT false,
      admin_remarks text,
      uploaded_at timestamp NOT NULL DEFAULT now(),
      verified_at timestamp,
      verified_by_id integer
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_reg_experience (
      id serial PRIMARY KEY,
      registration_id integer NOT NULL,
      company_name text NOT NULL,
      country text,
      city text,
      designation text,
      start_date text,
      end_date text,
      total_duration text,
      reason_for_leaving text,
      job_responsibilities text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_reg_education (
      id serial PRIMARY KEY,
      registration_id integer NOT NULL,
      certificate_name text NOT NULL,
      institute_name text,
      country text,
      passing_year text,
      grade text,
      file_data text,
      file_name text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_reg_relatives (
      id serial PRIMARY KEY,
      registration_id integer NOT NULL,
      relative_name text NOT NULL,
      relationship text,
      contact_number text,
      country text,
      address text,
      document_file_data text,
      document_file_name text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  console.log("✓ Employee registration tables created");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
