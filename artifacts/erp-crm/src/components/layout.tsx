import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useListNotifications } from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, Briefcase, Calendar, FileText, FileBox, Receipt,
  Banknote, Landmark, ShoppingCart, Package, Folders, HardHat, Clock,
  BarChart, Settings, Bell, LogOut, Menu, ChevronDown, ChevronRight,
  Building2, TruckIcon, Wrench, ClipboardList, FileCheck, UserCog, ScrollText
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
}

const NAV: NavGroup[] = [
  {
    label: "CRM",
    icon: Users,
    items: [
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
      { href: "/sales/quotations", label: "Quotations", icon: FileText },
      { href: "/sales/proforma-invoices", label: "Proforma Invoices", icon: FileCheck },
      { href: "/sales/lpos", label: "LPOs", icon: ClipboardList },
    ],
  },
  {
    label: "Accounts",
    icon: Receipt,
    items: [
      { href: "/accounts/invoices", label: "Tax Invoices", icon: Receipt },
      { href: "/accounts/delivery-notes", label: "Delivery Notes", icon: TruckIcon },
      { href: "/accounts/expenses", label: "Expenses", icon: Banknote },
      { href: "/accounts/cheques", label: "Cheques", icon: FileBox },
      { href: "/accounts/bank-accounts", label: "Bank Accounts", icon: Landmark },
    ],
  },
  {
    label: "Procurement",
    icon: ShoppingCart,
    items: [
      { href: "/procurement/suppliers", label: "Suppliers", icon: Building2 },
      { href: "/procurement/purchase-requests", label: "Purchase Requests", icon: ClipboardList },
      { href: "/procurement/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Inventory",
    icon: Package,
    items: [
      { href: "/inventory/items", label: "Items", icon: Package },
      { href: "/inventory/stock-entries", label: "Stock Entries", icon: FileBox },
    ],
  },
  {
    label: "Projects",
    icon: Folders,
    items: [
      { href: "/projects", label: "All Projects", icon: Folders },
    ],
  },
  {
    label: "HR",
    icon: HardHat,
    items: [
      { href: "/hr/employees", label: "Employees", icon: HardHat },
      { href: "/hr/attendance", label: "Attendance", icon: Clock },
    ],
  },
  {
    label: "Assets",
    icon: Wrench,
    items: [
      { href: "/assets", label: "Asset Register", icon: Wrench },
    ],
  },
  {
    label: "Reports",
    icon: BarChart,
    items: [
      { href: "/reports", label: "Reports Hub", icon: BarChart },
    ],
  },
  {
    label: "Admin",
    icon: Settings,
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
    ],
  },
];

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
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${isActive ? "bg-white/15 text-white font-medium" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-white/8"}`}>
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
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? "bg-white/15 text-white font-medium" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/8"}`}>
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

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">Prime Max</div>
            <div className="text-xs text-white/40 leading-tight">& Elite Prefab ERP</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <DashboardLink />
        {NAV.map(group => (
          <NavGroupItem key={group.label} group={group} />
        ))}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2 mb-2 px-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/40 truncate capitalize">{user?.role?.replace("_", " ")}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm"
          className="w-full justify-start h-8 text-white/50 hover:text-white hover:bg-white/10 text-xs"
          onClick={() => logout({})}>
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-sidebar">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center mx-auto">
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

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
