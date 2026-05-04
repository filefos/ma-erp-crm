import { db, contactsTable, companiesTable, clientCodeSeqsTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";

/**
 * Generate the next Client Code for a company.
 * Format: `${company.prefix}-CL-0001` (e.g. PM-CL-0001, EP-CL-0001).
 * Uses an atomic upsert against client_code_seqs so concurrent inserts
 * never collide.
 */
export async function genClientCode(companyId: number, tx: any = db): Promise<string> {
  const [co] = await tx
    .select({ prefix: companiesTable.prefix })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));
  const prefix = (co?.prefix ?? "PM").toUpperCase();
  const result: any = await tx.execute(sql`
    INSERT INTO client_code_seqs (company_id, last_seq)
    VALUES (${companyId}, 1)
    ON CONFLICT (company_id) DO UPDATE SET last_seq = client_code_seqs.last_seq + 1
    RETURNING last_seq
  `);
  const row = Array.isArray(result) ? result[0] : (result?.rows?.[0] ?? result?.[0]);
  const num = Number(row?.last_seq ?? row?.lastSeq ?? 1);
  return `${prefix}-CL-${String(num).padStart(4, "0")}`;
}

/**
 * Look up an existing contact with the same phone or email.
 * Restricted to the same companyId when provided.
 * Used for dedupe blocks before creating a new contact.
 */
export async function findDuplicateContact(
  companyId: number | null | undefined,
  phone: string | null | undefined,
  email: string | null | undefined,
) {
  const cleanPhone = (phone ?? "").trim();
  const cleanEmail = (email ?? "").trim();
  if (!cleanPhone && !cleanEmail) return null;
  const ors: any[] = [];
  if (cleanPhone) ors.push(eq(contactsTable.phone, cleanPhone));
  if (cleanEmail) ors.push(sql`lower(${contactsTable.email}) = lower(${cleanEmail})`);
  const orExpr = ors.length === 1 ? ors[0] : or(...ors);
  const where = companyId != null
    ? and(eq(contactsTable.companyId, companyId), orExpr)
    : orExpr;
  const [match] = await db.select().from(contactsTable).where(where!).limit(1);
  return match ?? null;
}
