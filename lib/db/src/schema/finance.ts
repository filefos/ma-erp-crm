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

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChequeSchema = createInsertSchema(chequesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, expenseNumber: true, createdAt: true, updatedAt: true });

export type BankAccount = typeof bankAccountsTable.$inferSelect;
export type Cheque = typeof chequesTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
