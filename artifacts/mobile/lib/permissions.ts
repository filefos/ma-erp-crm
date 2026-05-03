// Mirrors visibleGroupsFor() from artifacts/erp-crm/src/components/layout.tsx.
// Keep the two in sync — server-side scoping is enforced separately, but the
// nav surface should match exactly.

export type ModuleKey =
  | "CRM" | "Sales" | "Accounts" | "Procurement" | "Inventory"
  | "Projects" | "HR" | "Assets" | "Reports" | "Admin";

export type RoleHome =
  | "accountant" | "salesperson" | "attendance" | "crm"
  | "procurement" | "inventory" | "assets" | "admin";

const ADMIN_LEVELS = new Set(["super_admin", "company_admin"]);

const DEPT_GROUPS: Record<string, ModuleKey[]> = {
  Sales:        ["CRM", "Sales"],
  Accounts:     ["Accounts"],
  Finance:      ["Accounts", "Reports"],
  Procurement:  ["Procurement", "Inventory", "Assets"],
  Store:        ["Inventory"],
  Inventory:    ["Inventory"],
  Assets:       ["Assets"],
  HR:           ["HR"],
  Production:   ["Projects", "Assets"],
  Projects:     ["Projects"],
  Management:   ["CRM", "Sales", "Accounts", "Procurement", "Inventory", "Projects", "HR", "Assets", "Reports"],
  "Main Admin": ["CRM", "Sales", "Accounts", "Procurement", "Inventory", "Projects", "HR", "Assets", "Reports"],
};

const ROLE_GROUPS: Record<string, ModuleKey[]> = {
  sales:                ["CRM", "Sales"],
  accounts:             ["Accounts"],
  accountant:           ["Accounts"],
  accounts_manager:     ["Accounts"],
  finance:              ["Accounts", "Reports"],
  procurement:          ["Procurement", "Inventory", "Assets"],
  procurement_manager:  ["Procurement", "Inventory", "Assets"],
  procurement_assistant:["Procurement", "Inventory", "Assets"],
  store:                ["Inventory"],
  store_keeper:         ["Inventory"],
  main_store_keeper:    ["Inventory"],
  inventory:            ["Inventory"],
  hr:                   ["HR"],
  hr_manager:           ["HR"],
  hr_person:            ["HR"],
  project_manager:      ["Projects"],
  production:           ["Projects", "Assets"],
  management:           ["CRM", "Sales", "Accounts", "Procurement", "Inventory", "Projects", "HR", "Assets", "Reports"],
};

export interface UserLike {
  permissionLevel?: string | null;
  role?: string | null;
  departmentName?: string | null;
}

export const ALL_MODULES: ModuleKey[] = [
  "CRM", "Sales", "Accounts", "Procurement", "Inventory",
  "Projects", "HR", "Assets", "Reports", "Admin",
];

export function visibleModulesFor(user: UserLike | null | undefined): ModuleKey[] {
  if (!user) return [];
  const level = user.permissionLevel ?? "user";
  if (ADMIN_LEVELS.has(level)) return ALL_MODULES;
  const dept = user.departmentName ?? "";
  const role = (user.role ?? "").toLowerCase();
  const set = new Set<ModuleKey>(ROLE_GROUPS[role] ?? DEPT_GROUPS[dept] ?? []);
  if (set.size === 0) set.add("CRM");
  return ALL_MODULES.filter(m => set.has(m));
}

// Pick the role-based home dashboard. Priority: department admin attendance >
// role/department mapping. Mirrors the eight homes defined in the task.
export function homeFor(user: UserLike | null | undefined): RoleHome {
  if (!user) return "crm";
  const level = user.permissionLevel ?? "user";
  if (ADMIN_LEVELS.has(level)) return "admin";
  const role = (user.role ?? "").toLowerCase();
  const dept = user.departmentName ?? "";

  if (["accountant", "accounts", "accounts_manager", "finance"].includes(role)) return "accountant";
  if (dept === "Accounts" || dept === "Finance") return "accountant";

  if (role === "sales" || dept === "Sales") return "salesperson";

  if (["procurement", "procurement_manager", "procurement_assistant"].includes(role)) return "procurement";
  if (dept === "Procurement") return "procurement";

  if (["store", "store_keeper", "main_store_keeper", "inventory"].includes(role)) return "inventory";
  if (dept === "Store" || dept === "Inventory") return "inventory";

  if (dept === "Assets") return "assets";

  if (["hr", "hr_manager", "hr_person"].includes(role) || dept === "HR") return "attendance";

  // Production / projects users + everyone else default to CRM.
  if (["project_manager", "production"].includes(role)) return "crm";
  if (dept === "Production" || dept === "Projects") return "crm";

  return "crm";
}

export function isAdmin(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  return ADMIN_LEVELS.has(user.permissionLevel ?? "");
}
