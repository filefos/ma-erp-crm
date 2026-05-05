import { pgTable, serial, text, timestamp, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  iban: text("iban"),
  swiftCode: text("swift_code"),
  currency: text("currency").default("AED"),
  companyId: integer("company_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chequesTable = pgTable("cheques", {
  id: serial("id").primaryKey(),
  chequeNumber: text("cheque_number").notNull(),
  bankAccountId: integer("bank_account_id").notNull(),
  payeeName: text("payee_name").notNull(),
  amount: doublePrecision("amount").notNull(),
  amountInWords: text("amount_in_words"),
  chequeDate: text("cheque_date").notNull(),
  status: text("status").notNull().default("draft"),
  supplierId: integer("supplier_id"),
  projectId: integer("project_id"),
  voucherReference: text("voucher_reference"),
  companyId: integer("company_id").notNull(),
  preparedById: integer("prepared_by_id"),
  approvedById: integer("approved_by_id"),
  printedById: integer("printed_by_id"),
  printedAt: text("printed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  expenseNumber: text("expense_number").notNull().unique(),
  category: text("category").notNull(),
  supplierId: integer("supplier_id"),
  invoiceNumber: text("invoice_number"),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  amount: doublePrecision("amount").notNull(),
  vatAmount: doublePrecision("vat_amount").default(0),
  total: doublePrecision("total").notNull(),
  paymentMethod: text("payment_method").default("cash"),
  paymentDate: text("payment_date"),
  status: text("status").notNull().default("pending"),
  companyId: integer("company_id").notNull(),
  description: text("description"),
  createdById: integer("created_by_id"),
  approvedById: integer("approved_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chartOfAccountsTable = pgTable("chart_of_accounts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  accountCode: text("account_code").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(),
  parentId: integer("parent_id"),
  openingBalance: doublePrecision("opening_balance").default(0),
  currentBalance: doublePrecision("current_balance").default(0),
  currency: text("currency").default("AED"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentsReceivedTable = pgTable("payments_received", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  paymentNumber: text("payment_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  invoiceRef: text("invoice_ref"),
  taxInvoiceId: integer("tax_invoice_id"),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  paymentDate: text("payment_date").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  bankAccountId: integer("bank_account_id"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  attachments: text("attachments").default("[]"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentsMadeTable = pgTable("payments_made", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  paymentNumber: text("payment_number").notNull().unique(),
  payeeName: text("payee_name").notNull(),
  expenseRef: text("expense_ref"),
  expenseId: integer("expense_id"),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  paymentDate: text("payment_date").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  bankAccountId: integer("bank_account_id"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  journalNumber: text("journal_number").notNull().unique(),
  entryDate: text("entry_date").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  status: text("status").notNull().default("draft"),
  totalDebit: doublePrecision("total_debit").default(0),
  totalCredit: doublePrecision("total_credit").default(0),
  preparedById: integer("prepared_by_id"),
  approvedById: integer("approved_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const journalEntryLinesTable = pgTable("journal_entry_lines", {
  id: serial("id").primaryKey(),
  journalId: integer("journal_id").notNull(),
  accountId: integer("account_id"),
  accountName: text("account_name").notNull(),
  description: text("description"),
  debit: doublePrecision("debit").default(0),
  credit: doublePrecision("credit").default(0),
  sortOrder: integer("sort_order").default(0),
});

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChequeSchema = createInsertSchema(chequesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, expenseNumber: true, createdAt: true, updatedAt: true });
export const insertChartOfAccountSchema = createInsertSchema(chartOfAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentReceivedSchema = createInsertSchema(paymentsReceivedTable).omit({ id: true, paymentNumber: true, createdAt: true, updatedAt: true });
export const insertPaymentMadeSchema = createInsertSchema(paymentsMadeTable).omit({ id: true, paymentNumber: true, createdAt: true, updatedAt: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, journalNumber: true, createdAt: true, updatedAt: true });

export type BankAccount = typeof bankAccountsTable.$inferSelect;
export type Cheque = typeof chequesTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
export type ChartOfAccount = typeof chartOfAccountsTable.$inferSelect;
export type PaymentReceived = typeof paymentsReceivedTable.$inferSelect;
export type PaymentMade = typeof paymentsMadeTable.$inferSelect;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type JournalEntryLine = typeof journalEntryLinesTable.$inferSelect;
