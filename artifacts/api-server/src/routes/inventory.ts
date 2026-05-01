import { Router } from "express";
import { db, inventoryItemsTable, stockEntriesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Inventory Items
router.get("/inventory-items", async (req, res): Promise<void> => {
  let rows = await db.select().from(inventoryItemsTable).orderBy(inventoryItemsTable.name);
  const { category, companyId, lowStock, search } = req.query;
  if (category) rows = rows.filter(r => r.category === category);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (lowStock === "true") rows = rows.filter(r => r.currentStock <= r.minimumStock);
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.itemCode.toLowerCase().includes(s));
  }
  res.json(rows);
});

router.post("/inventory-items", async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryItemsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const itemCode = `ITEM-${String(num).padStart(5, "0")}`;
  const [item] = await db.insert(inventoryItemsTable).values({
    ...data, itemCode, currentStock: data.openingStock ?? 0,
  }).returning();
  res.status(201).json(item);
});

router.get("/inventory-items/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [item] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.put("/inventory-items/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [item] = await db.update(inventoryItemsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(inventoryItemsTable.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

// Stock Entries
router.get("/stock-entries", async (req, res): Promise<void> => {
  let rows = await db.select().from(stockEntriesTable).orderBy(sql`${stockEntriesTable.createdAt} desc`);
  const { type, itemId, companyId } = req.query;
  if (type) rows = rows.filter(r => r.type === type);
  if (itemId) rows = rows.filter(r => r.itemId === parseInt(itemId as string, 10));
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  
  const enriched = await Promise.all(rows.map(async (entry) => {
    const [item] = await db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable).where(eq(inventoryItemsTable.id, entry.itemId));
    let createdByName: string | undefined;
    if (entry.createdById) {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, entry.createdById));
      createdByName = u?.name;
    }
    return { ...entry, itemName: item?.name, createdByName };
  }));
  res.json(enriched);
});

router.post("/stock-entries", async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(stockEntriesTable);
  const num = (count[0]?.count ?? 0) + 1;
  const entryNumber = `SE-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;
  
  const [entry] = await db.insert(stockEntriesTable).values({
    ...data, entryNumber, createdById: req.user?.id, approvalStatus: "approved",
  }).returning();

  // Update stock
  const [item] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, data.itemId));
  if (item) {
    const delta = ["stock_in", "material_return"].includes(data.type) ? data.quantity : -Math.abs(data.quantity);
    await db.update(inventoryItemsTable).set({
      currentStock: Math.max(0, item.currentStock + delta),
      updatedAt: new Date(),
    }).where(eq(inventoryItemsTable.id, data.itemId));
  }

  const [itemRecord] = await db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable).where(eq(inventoryItemsTable.id, data.itemId));
  res.status(201).json({ ...entry, itemName: itemRecord?.name });
});

router.get("/stock-entries/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [entry] = await db.select().from(stockEntriesTable).where(eq(stockEntriesTable.id, id));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  const [item] = await db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable).where(eq(inventoryItemsTable.id, entry.itemId));
  res.json({ ...entry, itemName: item?.name });
});

export default router;
