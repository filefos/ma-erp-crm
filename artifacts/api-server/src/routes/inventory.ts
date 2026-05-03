import { Router } from "express";
import { db, inventoryItemsTable, stockEntriesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, inScope } from "../middlewares/auth";
import { notifyUsers } from "../lib/push";

const router = Router();
router.use(requireAuth);

// Inventory Items
router.get("/inventory-items", requirePermission("inventory_items", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(inventoryItemsTable).orderBy(inventoryItemsTable.name);
  rows = scopeFilter(req, rows);
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

router.post("/inventory-items", requirePermission("inventory_items", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryItemsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const itemCode = `ITEM-${String(num).padStart(5, "0")}`;
  const [item] = await db.insert(inventoryItemsTable).values({
    ...data, itemCode, currentStock: data.openingStock ?? 0,
  }).returning();
  res.status(201).json(item);
});

router.get("/inventory-items/:id", requirePermission("inventory_items", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [item] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [item]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(item);
});

router.put("/inventory-items/:id", requirePermission("inventory_items", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [item] = await db.update(inventoryItemsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(inventoryItemsTable.id, id)).returning();
  res.json(item);
});

// Stock Entries
router.get("/stock-entries", requirePermission("stock_entries", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(stockEntriesTable).orderBy(sql`${stockEntriesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
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

router.post("/stock-entries", requirePermission("stock_entries", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;

  // Verify the referenced inventory item belongs to the caller's company scope
  const [targetItem] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, data.itemId));
  if (!targetItem) { res.status(404).json({ error: "Inventory item not found" }); return; }
  if (!inScope(req, targetItem.companyId)) { res.status(403).json({ error: "Forbidden: inventory item belongs to a different company" }); return; }
  // Enforce that the item's companyId matches the stock entry's companyId
  if (targetItem.companyId != null && data.companyId != null && targetItem.companyId !== data.companyId) {
    res.status(400).json({ error: "itemId does not belong to the specified company" }); return;
  }

  const count = await db.select({ count: sql<number>`count(*)::int` }).from(stockEntriesTable);
  const num = (count[0]?.count ?? 0) + 1;
  const entryNumber = `SE-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;

  const [entry] = await db.insert(stockEntriesTable).values({
    ...data, entryNumber, createdById: req.user?.id, approvalStatus: "approved",
  }).returning();

  const delta = ["stock_in", "material_return"].includes(data.type) ? data.quantity : -Math.abs(data.quantity);
  const newStock = Math.max(0, targetItem.currentStock + delta);
  await db.update(inventoryItemsTable).set({
    currentStock: newStock,
    updatedAt: new Date(),
  }).where(eq(inventoryItemsTable.id, data.itemId));

  const [itemRecord] = await db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable).where(eq(inventoryItemsTable.id, data.itemId));

  // Low-stock push: fired only when this entry crossed below the minimum
  // threshold (above-or-equal -> below). Avoids spamming once an item is
  // already known-low and trickles further down.
  if (
    targetItem.minimumStock > 0 &&
    targetItem.currentStock >= targetItem.minimumStock &&
    newStock < targetItem.minimumStock
  ) {
    void (async () => {
      try {
        const candidates = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
        const recipients = candidates
          .filter(u => u.permissionLevel === "super_admin" || (u.permissionLevel === "company_admin" && u.companyId === targetItem.companyId))
          .map(u => u.id);
        if (recipients.length === 0) return;
        await notifyUsers({
          userIds: recipients,
          title: "Low stock alert",
          message: `${itemRecord?.name ?? `Item #${targetItem.id}`} dropped to ${newStock} (minimum ${targetItem.minimumStock}).`,
          type: "warning",
          entityType: "inventory_item",
          entityId: targetItem.id,
          data: { module: "inventory", id: targetItem.id },
        });
      } catch { /* best effort */ }
    })();
  }

  res.status(201).json({ ...entry, itemName: itemRecord?.name });
});

router.get("/stock-entries/:id", requirePermission("stock_entries", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [entry] = await db.select().from(stockEntriesTable).where(eq(stockEntriesTable.id, id));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [entry]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [item] = await db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable).where(eq(inventoryItemsTable.id, entry.itemId));
  res.json({ ...entry, itemName: item?.name });
});

export default router;
