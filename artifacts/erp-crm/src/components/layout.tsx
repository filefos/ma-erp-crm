import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useListNotifications } from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, Briefcase, Calendar, FileText, FileBox, Receipt,
  Banknote, Landmark, ShoppingCart, Package, Folders, HardHat, Clock,
  BarChart, Settings, Bell, LogOut, Menu, ChevronDown, ChevronRight,
  Building2, TruckIcon, Wrench, ClipboardList, FileCheck, UserCog, ScrollText, KeyRound, Home, Mail,
  BookOpen, ArrowDownCircle, ArrowUpCircle, BookMarked, PieChart, Bot, Send, ArrowLeft, TrendingUp,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  adminOnly?: boolean;
}

const NAV: NavGroup[] = [
  {
    label: "CRM",
    icon: Users,
    items: [
      { href: "/crm", label: "CRM Dashboard", icon: LayoutDashboard },
      { href: "/crm/pipeline", label: "Sales Pipeline", icon: Briefcase },
      { href: "/crm/follow-ups", label: "Follow-up Center", icon: Calendar },
      { href: "/crm/leaderboard", label: "Sales Leaderboard", icon: TrendingUp },
      { href: "/crm/reports", label: "CRM Reports", icon: BarChart },
      { href: "/crm/leads", label: "Leads", icon: Users },
      { href: "/crm/contacts", label: "Contacts", icon: HardHat },
      { href: "/crm/deals", label: "Deals", icon: Briefcase },
      { href: "/crm/activities", label: "Activities", icon: Calendar },
    ],
  },
  {
    label: "Sales",
    icon: FileText,
    items: [
      { href: "/sales/dashboard", label: "Sales Dashboard", icon: LayoutDashboard },
      { href: "/sales/quotations", label: "Quotations", icon: FileText },
      { href: "/sales/proforma-invoices", label: "Proforma Invoices", icon: FileCheck },
      { href: "/sales/lpos", label: "LPOs", icon: ClipboardList },
    ],
  },
  {
    label: "Accounts",
    icon: Receipt,
    items: [
      { href: "/accounts", label: "Accounts Dashboard", icon: LayoutDashboard },
      { href: "/accounts/invoices", label: "Tax Invoices", icon: Receipt },
      { href: "/accounts/delivery-notes", label: "Delivery Notes", icon: TruckIcon },
      { href: "/accounts/expenses", label: "Expenses", icon: Banknote },
      { href: "/accounts/payments-received", label: "Payments Received", icon: ArrowDownCircle },
      { href: "/accounts/payments-made", label: "Payments Made", icon: ArrowUpCircle },
      { href: "/accounts/cheques", label: "Cheques", icon: FileBox },
      { href: "/accounts/bank-accounts", label: "Bank Accounts", icon: Landmark },
      { href: "/accounts/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
      { href: "/accounts/journal-entries", label: "Journal Entries", icon: BookMarked },
      { href: "/accounts/vat-report", label: "VAT Report", icon: PieChart },
      { href: "/accounts/ai-assistant", label: "AI Assistant", icon: Bot },
    ],
  },
  {
    label: "Procurement",
    icon: ShoppingCart,
    items: [
      { href: "/procurement/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/procurement/suppliers", label: "Suppliers", icon: Building2 },
      { href: "/procurement/purchase-requests", label: "Purchase Requests", icon: ClipboardList },
      { href: "/procurement/rfqs", label: "RFQs", icon: Send },
      { href: "/procurement/supplier-quotations", label: "Quotations", icon: FileText },
      { href: "/procurement/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Inventory",
    icon: Package,
    items: [
      { href: "/inventory", label: "Inventory Dashboard", icon: LayoutDashboard },
      { href: "/inventory/items", label: "Items", icon: Package },
      { href: "/inventory/stock-entries", label: "Stock Entries", icon: FileBox },
    ],
  },
  {
    label: "Projects",
    icon: Folders,
    items: [
      { href: "/projects/dashboard", label: "Projects Dashboard", icon: LayoutDashboard },
      { href: "/projects", label: "All Projects", icon: Folders },
      { href: "/projects/sales-performance", label: "Sales Performance", icon: TrendingUp },
    ],
  },
  {
    label: "HR",
    icon: HardHat,
    items: [
      { href: "/hr/dashboard", label: "HR Dashboard", icon: LayoutDashboard },
      { href: "/hr/employees", label: "Employees", icon: HardHat },
      { href: "/hr/attendance", label: "Attendance", icon: Clock },
    ],
  },
  {
    label: "Assets",
    icon: Wrench,
    items: [
      { href: "/assets/dashboard", label: "Assets Dashboard", icon: LayoutDashboard },
      { href: "/assets", label: "Asset Register", icon: Wrench },
    ],
  },
  {
    label: "Email",
    icon: Mail,
    items: [
      { href: "/email/dashboard", label: "Email Dashboard", icon: LayoutDashboard },
      { href: "/email", label: "Email Panel", icon: Mail },
    ],
  },
  {
    label: "Reports",
    icon: BarChart,
    items: [
      { href: "/reports/dashboard", label: "Reports Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports Hub", icon: BarChart },
    ],
  },
  {
    label: "Admin",
    icon: Settings,
    adminOnly: true,
    items: [
      { href: "/admin/companies", label: "Companies", icon: Building2 },
      { href: "/admin/departments", label: "Departments", icon: Folders },
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/admin/roles", label: "Roles & Permissions", icon: KeyRound },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
      { href: "/admin/emails", label: "All Company Emails", icon: Mail },
    ],
  },
];

const ADMIN_LEVELS = new Set(["super_admin", "company_admin"]);
// Department/role admins see their own department's groups in full.
const DEPT_GROUPS: Record<string, string[]> = {
  Sales: ["CRM", "Sales"],
  Accounts: ["Accounts"],
  Finance: ["Accounts", "Reports"],
  Procurement: ["Procurement"],
  Store: ["Inventory"],
  Inventory: ["Inventory"],
  Assets: ["Assets"],
  HR: ["HR"],
  Production: ["Projects", "Assets"],
  Management: ["CRM", "Sales", "Accounts", "Procurement", "Inventory", "Projects", "HR", "Assets", "Reports"],
  "Main Admin": ["CRM", "Sales", "Accounts", "Procurement", "Inventory", "Projects", "HR", "Assets", "Reports"],
};
// Fallback by role code (for users with role-driven access when department is missing).
const ROLE_GROUPS: Record<string, string[]> = {
  sales: ["CRM", "Sales"],
  accounts: ["Accounts"],
  finance: ["Accounts", "Reports"],
  procurement: ["Procurement"],
  store: ["Inventory"],
  inventory: ["Inventory"],
  hr: ["HR"],
  production: ["Projects", "Assets"],
  management: ["CRM", "Sales", "Accounts", "Procurement", "Inventory", "Projects", "HR", "Assets", "Reports"],
};

function visibleGroupsFor(user: { permissionLevel?: string; role?: string; departmentName?: string } | undefined): NavGroup[] {
  const level = user?.permissionLevel ?? "user";
  if (ADMIN_LEVELS.has(level)) {
    // Admins see everything including the Admin group.
    return NAV;
  }
  // Non-admin: never show admin group.
  const nonAdminNav = NAV.filter(g => !g.adminOnly);
  const dept = user?.departmentName ?? "";
  const role = (user?.role ?? "").toLowerCase();
  const allowedLabels = new Set<string>(DEPT_GROUPS[dept] ?? ROLE_GROUPS[role] ?? []);
  if (allowedLabels.size === 0) {
    // Conservative default — at minimum let them see CRM if no mapping.
    allowedLabels.add("CRM");
  }
  return nonAdminNav.filter(g => allowedLabels.has(g.label));
}

function NavGroupItem({ group }: { group: NavGroup }) {
  const [location] = useLocation();
  const isGroupActive = group.items.some(i => location.startsWith(i.href));
  const [open, setOpen] = useState(isGroupActive);
  const Icon = group.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${isGroupActive ? "text-white font-medium" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />}
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {group.items.map(item => {
            const ItemIcon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href + "/"));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${isActive ? "bg-[#1e6ab0] text-white font-medium" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-white/8"}`}>
                <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardLink() {
  const [location] = useLocation();
  const isActive = location === "/" || location === "/dashboard";
  return (
    <Link href="/dashboard"
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? "bg-[#1e6ab0] text-white font-medium" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/8"}`}>
      <LayoutDashboard className="w-4 h-4 shrink-0" />
      Dashboard
    </Link>
  );
}

function NotificationBell() {
  const [, navigate] = useLocation();
  const { data: notifications } = useListNotifications();
  const unread = notifications?.filter(n => !n.isRead).length ?? 0;

  return (
    <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/notifications")}>
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );
}

function SidebarContent() {
  const { user, logout } = useAuth();
  const { companyShort, poweredBy } = useActiveCompany();
  const u = user as { name?: string; permissionLevel?: string; role?: string; departmentName?: string } | undefined;
  const level = u?.permissionLevel ?? "user";
  const visibleGroups = visibleGroupsFor(u);

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1e6ab0] rounded-lg flex items-center justify-center shrink-0 ring-1 ring-white/15">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">{companyShort}</div>
            <div className="text-[11px] text-white/50 leading-tight">Powered by {poweredBy}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <DashboardLink />
        {visibleGroups.map(group => (
          <NavGroupItem key={group.label} group={group} />
        ))}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-2 px-2">
          <div className="w-7 h-7 rounded-full bg-[#1e6ab0] flex items-center justify-center text-white text-xs font-bold shrink-0 ring-1 ring-white/15">
            {u?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{u?.name}</p>
            <p className="text-[10px] text-white/40 truncate capitalize">
              {level.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild
          className="w-full justify-start h-8 text-white/50 hover:text-white hover:bg-white/10 text-xs">
          <Link href="/profile">
            <UserCog className="w-3.5 h-3.5 mr-2" />
            My Profile
          </Link>
        </Button>
        <Button variant="ghost" size="sm"
          className="w-full justify-start h-8 text-white/50 hover:text-white hover:bg-white/10 text-xs"
          onClick={() => logout()}>
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

const ROUTE_LABELS: Record<string, string> = {
  crm: "CRM", sales: "Sales", accounts: "Accounts",
  procurement: "Procurement", inventory: "Inventory", hr: "HR",
  projects: "Projects", assets: "Assets", reports: "Reports", admin: "Admin",
  leads: "Leads", contacts: "Contacts", deals: "Deals", activities: "Activities", pipeline: "Sales Pipeline", "follow-ups": "Follow-up Center", leaderboard: "Sales Leaderboard",
  quotations: "Quotations", "proforma-invoices": "Proforma Invoices", lpos: "LPOs",
  invoices: "Tax Invoices", "delivery-notes": "Delivery Notes",
  expenses: "Expenses", cheques: "Cheques", "bank-accounts": "Bank Accounts",
  suppliers: "Suppliers", "purchase-requests": "Purchase Requests",
  "purchase-orders": "Purchase Orders", items: "Items",
  "stock-entries": "Stock Entries", dashboard: "Dashboard", employees: "Employees", attendance: "Attendance",
};

// Each top-level category's "home" / landing route — used by the
// "Back to <Category>" button that appears on every sub-page.
const CATEGORY_HOMES: Record<string, { label: string; href: string }> = {
  crm:         { label: "CRM",         href: "/crm" },
  sales:       { label: "Sales",       href: "/sales/dashboard" },
  accounts:    { label: "Accounts",    href: "/accounts" },
  procurement: { label: "Procurement", href: "/procurement/dashboard" },
  inventory:   { label: "Inventory",   href: "/inventory" },
  projects:    { label: "Projects",    href: "/projects/dashboard" },
  hr:          { label: "HR",          href: "/hr/dashboard" },
  assets:      { label: "Assets",      href: "/assets/dashboard" },
  email:       { label: "Email",       href: "/email/dashboard" },
  reports:     { label: "Reports",     href: "/reports/dashboard" },
  admin:       { label: "Admin",       href: "/admin/companies" },
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  const showBreadcrumb =
    location !== "/" &&
    location !== "/dashboard" &&
    !location.startsWith("/login") &&
    !location.startsWith("/profile");

  const breadcrumbItems = (() => {
    const parts = location.split("/").filter(Boolean);
    const items: { label: string; href: string }[] = [];
    let path = "";
    for (const part of parts) {
      path += "/" + part;
      if (/^\d+$/.test(part)) continue;
      const label = ROUTE_LABELS[part] ?? part.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      items.push({ label, href: path });
    }
    return items;
  })();

  // "Back to ..." target — appears on every page except Dashboard / root /
  // login / profile. Strategy:
  //   - 3+ URL segments  → back to the 2-segment parent (e.g. quotation
  //     detail/edit → quotations list)
  //   - 2 segments       → back to the category's home page if different,
  //     otherwise to Dashboard
  //   - 1 segment        → back to Dashboard
  const backTarget = (() => {
    if (!showBreadcrumb) return null;
    const parts = location.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    // 3+ segments → parent route (drop the last segment)
    if (parts.length >= 3) {
      const parentSeg = parts[parts.length - 2];
      // Skip numeric IDs as the visible parent label
      const labelSeg = /^\d+$/.test(parentSeg) ? parts[0] : parentSeg;
      const label = ROUTE_LABELS[labelSeg]
        ?? labelSeg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      return { label, href: "/" + parts.slice(0, -1).join("/") };
    }

    // 2 segments under a known category → category home (if different)
    if (parts.length === 2) {
      const cat = CATEGORY_HOMES[parts[0]];
      if (cat && location !== cat.href) return cat;
    }

    // Fallback (1 segment, or 2 segments already at category home / unknown)
    return { label: "Dashboard", href: "/dashboard" };
  })();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-sidebar">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 bg-[#1e6ab0] rounded-xl flex items-center justify-center mx-auto">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="text-white/60 text-sm">Loading ERP CRM...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || location === "/login") return <>{children}</>;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-56 lg:w-60 flex-shrink-0">
        <div className="w-full">
          <SidebarContent />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 border-b bg-card flex items-center justify-between px-4 flex-shrink-0 gap-4">
          {/* Mobile hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-60 border-none">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex-1" />

          <NotificationBell />
        </header>

        {showBreadcrumb && (
          <div className="border-b bg-muted/20 px-4 md:px-6 py-1.5 flex items-center gap-2 text-xs text-muted-foreground shrink-0 overflow-x-auto">
            {backTarget && (
              <>
                <Link
                  href={backTarget.href}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0f2d5a] text-white hover:bg-[#1e6ab0] transition-colors shrink-0 font-medium"
                  data-testid="link-back-to-category"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to {backTarget.label}</span>
                </Link>
                <span className="h-4 w-px bg-border shrink-0" aria-hidden />
              </>
            )}
            <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1 shrink-0">
              <Home className="w-3 h-3" />
              <span>Home</span>
            </Link>
            {breadcrumbItems.map((item, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3 h-3" />
                {i === breadcrumbItems.length - 1 ? (
                  <span className="text-foreground font-medium">{item.label}</span>
                ) : (
                  <Link href={item.href} className="hover:text-foreground transition-colors">{item.label}</Link>
                )}
              </span>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
