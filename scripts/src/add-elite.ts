import { db } from "@workspace/db";
import { companiesTable, departmentsTable, userCompanyAccessTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  const [elite] = await db.insert(companiesTable).values({
    name: "Elite Pre-Fabricated Houses Trading Co. LLC",
    shortName: "Elite",
    prefix: "EL",
    trn: "104200550200003",
    vatPercent: 5,
    bankDetails: [
      "Account Title: E L I T E PRE FABRICATED HOUSES TRA",
      "IBAN: AE320030013438011920001",
      "Account Number: 13438011920001",
      "BIC / SWIFT: ADCBAEAAXXX",
      "Bank: ABU DHABI COMMERCIAL BANK",
    ].join("\n"),
  }).returning();
  console.log(`Created company: ${elite.name} (id=${elite.id})`);

  await db.insert(departmentsTable).values({ name: "Administration" });
  console.log("Created Administration dept for Elite");

  await db.update(companiesTable).set({
    bankDetails: [
      "Account Title: PRIME MAX PREFAB HOUSES IND LLC SP",
      "IBAN: AE300030014498851920002",
      "Account Number: 14498851920002",
      "BIC / SWIFT: ADCBAEAAXXX",
      "Bank: ABU DHABI COMMERCIAL BANK",
    ].join("\n"),
  }).where(eq(companiesTable.id, 1));
  console.log("Updated Prime Max bank details (added bank name)");

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, "filefos@gmail.com"));
  if (admin) {
    await db.insert(userCompanyAccessTable)
      .values({ userId: admin.id, companyId: elite.id, isPrimary: false })
      .onConflictDoNothing();
    console.log("Granted admin access to Elite");
  }

  console.log("\n✓ Done!");
  process.exit(0);
}

run().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
