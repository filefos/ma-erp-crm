import { pgTable, serial, text, boolean, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  permissionLevel: integer("permission_level").notNull().default(50),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const permissionsTable = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id").notNull(),
    module: text("module").notNull(),
    canView: boolean("can_view").notNull().default(false),
    canCreate: boolean("can_create").notNull().default(false),
    canEdit: boolean("can_edit").notNull().default(false),
    canApprove: boolean("can_approve").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    canExport: boolean("can_export").notNull().default(false),
    canPrint: boolean("can_print").notNull().default(false),
  },
  (t) => [uniqueIndex("permissions_role_module_idx").on(t.roleId, t.module)],
);

export const userCompanyAccessTable = pgTable(
  "user_company_access",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    companyId: integer("company_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uca_user_company_idx").on(t.userId, t.companyId)],
);

export const userPermissionsTable = pgTable(
  "user_permissions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    module: text("module").notNull(),
    canView: boolean("can_view"),
    canCreate: boolean("can_create"),
    canEdit: boolean("can_edit"),
    canApprove: boolean("can_approve"),
    canDelete: boolean("can_delete"),
    canExport: boolean("can_export"),
    canPrint: boolean("can_print"),
  },
  (t) => [uniqueIndex("user_permissions_user_module_idx").on(t.userId, t.module)],
);

export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true });
export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true });
export const insertUserCompanyAccessSchema = createInsertSchema(userCompanyAccessTable).omit({ id: true, createdAt: true });
export const insertUserPermissionSchema = createInsertSchema(userPermissionsTable).omit({ id: true });

export type Role = typeof rolesTable.$inferSelect;
export type Permission = typeof permissionsTable.$inferSelect;
export type UserCompanyAccess = typeof userCompanyAccessTable.$inferSelect;
export type UserPermission = typeof userPermissionsTable.$inferSelect;

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type InsertUserCompanyAccess = z.infer<typeof insertUserCompanyAccessSchema>;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
