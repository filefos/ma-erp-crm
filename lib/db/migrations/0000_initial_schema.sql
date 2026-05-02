CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"prefix" text NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"trn" text,
	"vat_percent" double precision DEFAULT 5,
	"logo" text,
	"bank_details" text,
	"letterhead" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'sales' NOT NULL,
	"department_id" integer,
	"company_id" integer,
	"permission_level" text DEFAULT 'user',
	"status" text DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"module" text NOT NULL,
	"can_view" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_approve" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_export" boolean DEFAULT false NOT NULL,
	"can_print" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permission_level" integer DEFAULT 50 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_company_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"module" text NOT NULL,
	"can_view" boolean,
	"can_create" boolean,
	"can_edit" boolean,
	"can_approve" boolean,
	"can_delete" boolean,
	"can_export" boolean,
	"can_print" boolean
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_number" text NOT NULL,
	"lead_name" text NOT NULL,
	"company_name" text,
	"contact_person" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"location" text,
	"source" text,
	"requirement_type" text,
	"quantity" double precision,
	"budget" double precision,
	"status" text DEFAULT 'new' NOT NULL,
	"assigned_to_id" integer,
	"notes" text,
	"next_follow_up" text,
	"lead_score" text DEFAULT 'cold' NOT NULL,
	"company_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_lead_number_unique" UNIQUE("lead_number")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"whatsapp" text,
	"company_name" text,
	"designation" text,
	"company_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_number" text NOT NULL,
	"title" text NOT NULL,
	"client_name" text,
	"value" double precision DEFAULT 0,
	"stage" text DEFAULT 'new' NOT NULL,
	"probability" double precision DEFAULT 0,
	"expected_close_date" text,
	"assigned_to_id" integer,
	"company_id" integer,
	"lead_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deals_deal_number_unique" UNIQUE("deal_number")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"due_date" text,
	"is_done" boolean DEFAULT false NOT NULL,
	"lead_id" integer,
	"deal_id" integer,
	"contact_id" integer,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'nos' NOT NULL,
	"rate" double precision DEFAULT 0 NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_number" text NOT NULL,
	"company_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_phone" text,
	"project_name" text,
	"project_location" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" double precision DEFAULT 0,
	"discount" double precision DEFAULT 0,
	"vat_percent" double precision DEFAULT 5,
	"vat_amount" double precision DEFAULT 0,
	"grand_total" double precision DEFAULT 0,
	"payment_terms" text,
	"delivery_terms" text,
	"validity" text,
	"terms_conditions" text,
	"prepared_by_id" integer,
	"approved_by_id" integer,
	"lead_id" integer,
	"deal_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number")
);
--> statement-breakpoint
CREATE TABLE "delivery_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"dn_number" text NOT NULL,
	"company_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text,
	"delivery_location" text,
	"vehicle_number" text,
	"driver_name" text,
	"receiver_name" text,
	"delivery_date" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"tax_invoice_id" integer,
	"project_id" integer,
	"items" text DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_notes_dn_number_unique" UNIQUE("dn_number")
);
--> statement-breakpoint
CREATE TABLE "lpos" (
	"id" serial PRIMARY KEY NOT NULL,
	"lpo_number" text NOT NULL,
	"company_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"project_id" integer,
	"quotation_id" integer,
	"lpo_date" text,
	"lpo_value" double precision DEFAULT 0 NOT NULL,
	"scope" text,
	"delivery_schedule" text,
	"payment_terms" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lpos_lpo_number_unique" UNIQUE("lpo_number")
);
--> statement-breakpoint
CREATE TABLE "proforma_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"pi_number" text NOT NULL,
	"company_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text,
	"quotation_id" integer,
	"subtotal" double precision DEFAULT 0,
	"vat_amount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0 NOT NULL,
	"payment_terms" text,
	"validity_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"prepared_by_id" integer,
	"approved_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "proforma_invoices_pi_number_unique" UNIQUE("pi_number")
);
--> statement-breakpoint
CREATE TABLE "tax_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"company_id" integer NOT NULL,
	"company_trn" text,
	"client_name" text NOT NULL,
	"client_trn" text,
	"invoice_date" text,
	"supply_date" text,
	"quotation_id" integer,
	"project_id" integer,
	"subtotal" double precision DEFAULT 0,
	"vat_percent" double precision DEFAULT 5,
	"vat_amount" double precision DEFAULT 0,
	"grand_total" double precision DEFAULT 0 NOT NULL,
	"amount_paid" double precision DEFAULT 0,
	"balance" double precision DEFAULT 0,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tax_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_number" text NOT NULL,
	"project_name" text NOT NULL,
	"client_name" text NOT NULL,
	"company_id" integer NOT NULL,
	"location" text,
	"scope" text,
	"quotation_id" integer,
	"lpo_id" integer,
	"project_value" double precision DEFAULT 0,
	"stage" text DEFAULT 'new_project' NOT NULL,
	"production_status" text DEFAULT 'pending',
	"procurement_status" text DEFAULT 'pending',
	"delivery_status" text DEFAULT 'pending',
	"installation_status" text DEFAULT 'pending',
	"payment_status" text DEFAULT 'pending',
	"project_manager_id" integer,
	"start_date" text,
	"end_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_project_number_unique" UNIQUE("project_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"purchase_request_id" integer,
	"subtotal" double precision DEFAULT 0,
	"vat_amount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"payment_terms" text,
	"delivery_date" text,
	"approved_by_id" integer,
	"items" text DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"pr_number" text NOT NULL,
	"company_id" integer NOT NULL,
	"project_id" integer,
	"description" text NOT NULL,
	"priority" text DEFAULT 'normal',
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by_id" integer,
	"approved_by_id" integer,
	"required_date" text,
	"items" text DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_requests_pr_number_unique" UNIQUE("pr_number")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"trn" text,
	"category" text,
	"payment_terms" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text DEFAULT 'nos',
	"current_stock" double precision DEFAULT 0 NOT NULL,
	"opening_stock" double precision DEFAULT 0,
	"minimum_stock" double precision DEFAULT 0 NOT NULL,
	"unit_cost" double precision DEFAULT 0,
	"warehouse_location" text,
	"company_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_item_code_unique" UNIQUE("item_code")
);
--> statement-breakpoint
CREATE TABLE "stock_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_number" text NOT NULL,
	"type" text NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" text,
	"reference" text,
	"notes" text,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"approved_by_id" integer,
	"created_by_id" integer,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"purchase_date" text,
	"purchase_value" double precision DEFAULT 0,
	"current_location" text,
	"assigned_to" text,
	"condition" text DEFAULT 'good',
	"maintenance_date" text,
	"status" text DEFAULT 'active' NOT NULL,
	"company_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" text NOT NULL,
	"check_in" text,
	"check_out" text,
	"overtime" double precision DEFAULT 0,
	"status" text DEFAULT 'present' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"selfie_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'staff' NOT NULL,
	"designation" text,
	"department_id" integer,
	"company_id" integer NOT NULL,
	"phone" text,
	"email" text,
	"nationality" text,
	"site_location" text,
	"joining_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"iban" text,
	"swift_code" text,
	"currency" text DEFAULT 'AED',
	"company_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheques" (
	"id" serial PRIMARY KEY NOT NULL,
	"cheque_number" text NOT NULL,
	"bank_account_id" integer NOT NULL,
	"payee_name" text NOT NULL,
	"amount" double precision NOT NULL,
	"amount_in_words" text,
	"cheque_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"supplier_id" integer,
	"project_id" integer,
	"voucher_reference" text,
	"company_id" integer NOT NULL,
	"prepared_by_id" integer,
	"approved_by_id" integer,
	"printed_by_id" integer,
	"printed_at" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_number" text NOT NULL,
	"category" text NOT NULL,
	"supplier_id" integer,
	"invoice_number" text,
	"amount" double precision NOT NULL,
	"vat_amount" double precision DEFAULT 0,
	"total" double precision NOT NULL,
	"payment_method" text DEFAULT 'cash',
	"payment_date" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"company_id" integer NOT NULL,
	"description" text,
	"created_by_id" integer,
	"approved_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_expense_number_unique" UNIQUE("expense_number")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_name" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"details" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"user_id" integer NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_role_module_idx" ON "permissions" USING btree ("role_id","module");--> statement-breakpoint
CREATE UNIQUE INDEX "uca_user_company_idx" ON "user_company_access" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_permissions_user_module_idx" ON "user_permissions" USING btree ("user_id","module");