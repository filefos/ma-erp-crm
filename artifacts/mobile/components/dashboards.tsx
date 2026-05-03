import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAttendanceQueryKey,
  useAttendanceCheckIn,
  useAttendanceCheckOut,
  useListAttendance,
  useListAssets,
  useListCheques,
  useListDeals,
  useListEmployees,
  useListExpenses,
  useListInventoryItems,
  useListLeads,
  useListPurchaseOrders,
  useListPurchaseRequests,
  useListQuotations,
  useListRfqs,
  useListTaxInvoices,
  useListUsers,
} from "@workspace/api-client-react";
import {
  BrandButton,
  Card,
  EmptyState,
  KpiGrid,
  KpiTile,
  QuickLink,
  SectionHeading,
  Skeleton,
} from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { DashboardScreen } from "@/components/Dashboard";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { attendanceStatusMeta } from "@/lib/format";
import { captureAndUploadAttendance, showAttendanceError } from "@/lib/attendance";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function count<T>(data: T[] | undefined, predicate?: (t: T) => boolean): number {
  if (!data) return 0;
  return predicate ? data.filter(predicate).length : data.length;
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function KpiSkeleton() {
  return (
    <KpiGrid>
      {[0, 1, 2, 3].map(i => (
        <Card key={i} style={{ flexBasis: "48%", flexGrow: 1, gap: 8 }}>
          <Skeleton height={20} width={60} />
          <Skeleton height={12} width={100} />
        </Card>
      ))}
    </KpiGrid>
  );
}

// ---------------------------------------------------------------------------
// Accountant
// ---------------------------------------------------------------------------
export function AccountantDashboard() {
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const invoices = useListTaxInvoices();
  const expenses = useListExpenses();
  const cheques = useListCheques();

  const loading = invoices.isLoading || expenses.isLoading || cheques.isLoading;
  const totalInvoiced = (invoices.data ?? []).reduce((s, i) => s + num(i.grandTotal), 0);
  const unpaidInvoices = count(invoices.data, i => (i.status ?? "").toLowerCase() !== "paid");
  const expenseTotal = (expenses.data ?? []).reduce((s, e) => s + num(e.amount), 0);
  const pendingCheques = count(cheques.data, c => ["pending", "issued"].includes((c.status ?? "").toLowerCase()));

  return (
    <DashboardScreen
      title={`Hello, ${user?.name?.split(" ")[0] ?? "Accountant"}`}
      subtitle={activeCompany?.short ? `${activeCompany.short} · Finance` : "Finance"}
    >
      <SectionHeading title="Today's KPIs" />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="Total invoiced" value={fmtMoney(totalInvoiced)} icon="file-text" tone="navy" />
          <KpiTile label="Unpaid invoices" value={unpaidInvoices} icon="alert-circle" tone="orange" />
          <KpiTile label="Expenses (AED)" value={fmtMoney(expenseTotal)} icon="trending-down" tone="blue" />
          <KpiTile label="Cheques pending" value={pendingCheques} icon="clock" tone="muted" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="file-text" label="Tax invoices" hint={`${count(invoices.data)} on file`} onPress={() => router.push("/accounts")} />
      <QuickLink icon="trending-down" label="Expenses" hint={`${count(expenses.data)} entries`} onPress={() => router.push("/accounts")} />
      <QuickLink icon="credit-card" label="Cheques & banks" onPress={() => router.push("/accounts")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// Salesperson
// ---------------------------------------------------------------------------
export function SalespersonDashboard() {
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const myUserId = user?.id;
  const leads = useListLeads();
  const deals = useListDeals();
  const quotations = useListQuotations();

  const loading = leads.isLoading || deals.isLoading || quotations.isLoading;
  const myLeads = count(leads.data, l => l.assignedToId === myUserId);
  const openDeals = count(deals.data, d => !["won", "lost"].includes((d.stage ?? "").toLowerCase()));
  const pendingQuotes = count(quotations.data, q => ["draft", "sent", "pending"].includes((q.status ?? "").toLowerCase()));
  const wonValue = (deals.data ?? [])
    .filter(d => (d.stage ?? "").toLowerCase() === "won")
    .reduce((s, d) => s + num(d.value), 0);

  return (
    <DashboardScreen
      title={`Hi, ${user?.name?.split(" ")[0] ?? "Sales"}`}
      subtitle={activeCompany?.short ? `${activeCompany.short} · Sales` : "Sales"}
    >
      <SectionHeading title="Pipeline" />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="My leads" value={myLeads} icon="user-plus" tone="navy" />
          <KpiTile label="Open deals" value={openDeals} icon="trending-up" tone="blue" />
          <KpiTile label="Pending quotes" value={pendingQuotes} icon="file-text" tone="orange" />
          <KpiTile label="Won (AED)" value={fmtMoney(wonValue)} icon="award" tone="muted" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="users" label="CRM & leads" hint={`${count(leads.data)} total`} onPress={() => router.push("/crm")} />
      <QuickLink icon="file-text" label="Quotations" onPress={() => router.push("/sales")} />
      <QuickLink icon="trending-up" label="Deals" onPress={() => router.push("/crm")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// Employee Attendance (HR)
// ---------------------------------------------------------------------------
export function AttendanceDashboard() {
  const router = useRouter();
  const c = useColors();
  const qc = useQueryClient();
  const { user, activeCompany, activeCompanyId } = useApp();
  const attendance = useListAttendance();
  const employees = useListEmployees(activeCompanyId ? { companyId: activeCompanyId } : {});
  const today = new Date().toISOString().slice(0, 10);
  const todayList = (attendance.data ?? []).filter(a => (a.date ?? "").slice(0, 10) === today);

  const loading = attendance.isLoading;
  const present = count(todayList, a => (a.status ?? "").toLowerCase() === "present");
  const absent = count(todayList, a => (a.status ?? "").toLowerCase() === "absent");
  const late = count(todayList, a => (a.status ?? "").toLowerCase() === "late");

  const myEmployee = useMemo(() => {
    if (!user) return null;
    const email = (user.email ?? "").toLowerCase();
    if (!email) return null;
    return (employees.data ?? []).find(e => (e.email ?? "").toLowerCase() === email) ?? null;
  }, [employees.data, user]);

  const myToday = useMemo(
    () => myEmployee ? todayList.find(r => r.employeeId === myEmployee.id) ?? null : null,
    [todayList, myEmployee],
  );

  const checkInMut = useAttendanceCheckIn({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => showAttendanceError(e),
    },
  });
  const checkOutMut = useAttendanceCheckOut({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => showAttendanceError(e),
    },
  });
  const [busy, setBusy] = useState<null | "in" | "out">(null);

  const checkIn = async () => {
    if (busy) return;
    setBusy("in");
    try {
      const cap = await captureAndUploadAttendance();
      await checkInMut.mutateAsync({
        data: {
          latitude: cap.gps.latitude,
          longitude: cap.gps.longitude,
          accuracyMeters: cap.gps.accuracyMeters ?? undefined,
          address: cap.gps.address,
          selfieObjectKey: cap.selfieObjectKey,
          source: "mobile_gps",
        },
      });
    } catch (e) {
      showAttendanceError(e);
    } finally {
      setBusy(null);
    }
  };
  const checkOut = async () => {
    if (busy) return;
    setBusy("out");
    try {
      const cap = await captureAndUploadAttendance();
      await checkOutMut.mutateAsync({
        data: {
          latitude: cap.gps.latitude,
          longitude: cap.gps.longitude,
          accuracyMeters: cap.gps.accuracyMeters ?? undefined,
          address: cap.gps.address,
          selfieObjectKey: cap.selfieObjectKey,
          source: "mobile_gps",
        },
      });
    } catch (e) {
      showAttendanceError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardScreen
      title={`Attendance`}
      subtitle={activeCompany?.short ? `${activeCompany.short} · HR · ${user?.name ?? ""}` : "HR"}
    >
      <SectionHeading title="My attendance · today" />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: c.foreground, flex: 1 }}>
            {myEmployee?.name ?? user?.name ?? "Field staff"}
          </Text>
          {myToday ? (
            <StatusPill
              label={attendanceStatusMeta(myToday.status).label}
              tone={attendanceStatusMeta(myToday.status).tone}
            />
          ) : null}
        </View>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground }}>
          {myToday?.checkIn ? `In ${myToday.checkIn}` : "Not checked in yet"}
          {myToday?.checkOut ? ` · Out ${myToday.checkOut}` : ""}
        </Text>
        {myToday?.address ? (
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground }} numberOfLines={2}>
            <Feather name="map-pin" size={11} color={c.mutedForeground} /> {myToday.address}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {myToday?.selfieSignedUrl ? (
            <Image
              source={{ uri: myToday.selfieSignedUrl }}
              style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: c.muted }}
              contentFit="cover"
            />
          ) : null}
          {myToday?.checkOutSelfieSignedUrl ? (
            <Image
              source={{ uri: myToday.checkOutSelfieSignedUrl }}
              style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: c.muted }}
              contentFit="cover"
            />
          ) : null}
          {!myEmployee && !employees.isLoading ? (
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground, flex: 1 }}>
              No employee record linked to your login. Ask HR to add one with your email.
            </Text>
          ) : !myToday ? (
            <BrandButton
              label="Check in (GPS + selfie)"
              icon="camera"
              onPress={checkIn}
              loading={busy === "in"}
              disabled={!myEmployee}
              style={{ flex: 1, minWidth: 200 }}
            />
          ) : !myToday.checkOut ? (
            <BrandButton
              label="Check out (GPS + selfie)"
              icon="camera"
              variant="secondary"
              onPress={checkOut}
              loading={busy === "out"}
              style={{ flex: 1, minWidth: 200 }}
            />
          ) : (
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.success }}>
              Day complete · thanks!
            </Text>
          )}
        </View>
        {myEmployee && !myToday ? (
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: c.mutedForeground }}>
            Location and a wide-angle selfie are required for check-in. Both are uploaded securely.
          </Text>
        ) : null}
      </Card>

      <SectionHeading title={`Team · ${today}`} />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="Present" value={present} icon="check-circle" tone="blue" />
          <KpiTile label="Late" value={late} icon="clock" tone="orange" />
          <KpiTile label="Absent" value={absent} icon="x-circle" tone="muted" />
          <KpiTile label="Total checked-in" value={todayList.length} icon="users" tone="navy" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="user-check" label="Attendance log" hint="Today's status, history, manager grid" onPress={() => router.push("/hr/attendance")} />
      <QuickLink icon="users" label="Employees" onPress={() => router.push("/hr")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// CRM (default)
// ---------------------------------------------------------------------------
export function CrmDashboard() {
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const leads = useListLeads();
  const deals = useListDeals();

  const loading = leads.isLoading || deals.isLoading;
  const newLeads = count(leads.data, l => (l.status ?? "").toLowerCase() === "new");
  const qualified = count(leads.data, l => (l.status ?? "").toLowerCase() === "qualified");
  const openDeals = count(deals.data, d => !["won", "lost"].includes((d.stage ?? "").toLowerCase()));
  const lostDeals = count(deals.data, d => (d.stage ?? "").toLowerCase() === "lost");

  return (
    <DashboardScreen
      title={`Hello, ${user?.name?.split(" ")[0] ?? "there"}`}
      subtitle={activeCompany?.short ? `${activeCompany.short} · CRM` : "CRM"}
    >
      <SectionHeading title="Lead funnel" />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="New leads" value={newLeads} icon="user-plus" tone="navy" />
          <KpiTile label="Qualified" value={qualified} icon="check" tone="blue" />
          <KpiTile label="Open deals" value={openDeals} icon="trending-up" tone="orange" />
          <KpiTile label="Lost deals" value={lostDeals} icon="x" tone="muted" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="users" label="Leads" hint={`${count(leads.data)} total`} onPress={() => router.push("/crm")} />
      <QuickLink icon="trending-up" label="Deals" hint={`${count(deals.data)} total`} onPress={() => router.push("/crm")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------
export function ProcurementDashboard() {
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const prs = useListPurchaseRequests();
  const pos = useListPurchaseOrders();
  const rfqs = useListRfqs();

  const loading = prs.isLoading || pos.isLoading || rfqs.isLoading;
  const openPRs = count(prs.data, r => ["pending", "submitted", "approved"].includes((r.status ?? "").toLowerCase()));
  const openPOs = count(pos.data, p => ["draft", "issued", "approved"].includes((p.status ?? "").toLowerCase()));
  const openRfqs = count(rfqs.data, r => ["open", "sent"].includes((r.status ?? "").toLowerCase()));
  const poTotal = (pos.data ?? []).reduce((s, p) => s + num(p.total), 0);

  return (
    <DashboardScreen
      title={`Procurement`}
      subtitle={activeCompany?.short ? `${activeCompany.short} · ${user?.name ?? ""}` : "Procurement"}
    >
      <SectionHeading title="Open work" />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="Open PRs" value={openPRs} icon="clipboard" tone="navy" />
          <KpiTile label="Open POs" value={openPOs} icon="shopping-cart" tone="blue" />
          <KpiTile label="Open RFQs" value={openRfqs} icon="send" tone="orange" />
          <KpiTile label="PO total" value={fmtMoney(poTotal)} icon="dollar-sign" tone="muted" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="clipboard" label="Purchase requests" onPress={() => router.push("/procurement")} />
      <QuickLink icon="shopping-cart" label="Purchase orders" onPress={() => router.push("/procurement")} />
      <QuickLink icon="send" label="RFQs" onPress={() => router.push("/procurement")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export function InventoryDashboard() {
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const items = useListInventoryItems();

  const loading = items.isLoading;
  const totalItems = count(items.data);
  const lowStock = count(items.data, i => num(i.currentStock) <= num(i.minimumStock) && num(i.minimumStock) > 0);
  const outOfStock = count(items.data, i => num(i.currentStock) <= 0);
  const stockValue = (items.data ?? []).reduce((s, i) => s + num(i.currentStock) * num(i.unitCost), 0);

  return (
    <DashboardScreen
      title={`Inventory`}
      subtitle={activeCompany?.short ? `${activeCompany.short} · ${user?.name ?? ""}` : "Inventory"}
    >
      <SectionHeading title="Stock overview" />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="Items tracked" value={totalItems} icon="package" tone="navy" />
          <KpiTile label="Low stock" value={lowStock} icon="alert-triangle" tone="orange" />
          <KpiTile label="Out of stock" value={outOfStock} icon="x-octagon" tone="muted" />
          <KpiTile label="Stock value" value={fmtMoney(stockValue)} icon="dollar-sign" tone="blue" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="package" label="Items" onPress={() => router.push("/inventory")} />
      <QuickLink icon="repeat" label="Stock movements" onPress={() => router.push("/inventory")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
export function AssetsDashboard() {
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const assets = useListAssets();

  const loading = assets.isLoading;
  const totalAssets = count(assets.data);
  const inUse = count(assets.data, a => (a.status ?? "").toLowerCase() === "in_use" || (a.status ?? "").toLowerCase() === "active");
  const maintenance = count(assets.data, a => (a.status ?? "").toLowerCase() === "maintenance");
  const totalValue = (assets.data ?? []).reduce((s, a) => s + num(a.purchaseValue), 0);

  return (
    <DashboardScreen
      title={`Assets`}
      subtitle={activeCompany?.short ? `${activeCompany.short} · ${user?.name ?? ""}` : "Assets"}
    >
      <SectionHeading title="Portfolio" />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="Tracked assets" value={totalAssets} icon="tool" tone="navy" />
          <KpiTile label="In use" value={inUse} icon="check-circle" tone="blue" />
          <KpiTile label="Maintenance" value={maintenance} icon="settings" tone="orange" />
          <KpiTile label="Total value" value={fmtMoney(totalValue)} icon="dollar-sign" tone="muted" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="tool" label="Asset register" onPress={() => router.push("/assets")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export function AdminDashboard() {
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const users = useListUsers();
  const leads = useListLeads();
  const deals = useListDeals();
  const invoices = useListTaxInvoices();

  const loading = users.isLoading || leads.isLoading || deals.isLoading || invoices.isLoading;
  const totalUsers = count(users.data);
  const activeUsers = count(users.data, u => u.isActive !== false);
  const totalLeads = count(leads.data);
  const invoiced = (invoices.data ?? []).reduce((s, i) => s + num(i.grandTotal), 0);

  return (
    <DashboardScreen
      title={`Admin · ${activeCompany?.short ?? ""}`}
      subtitle={user?.name ?? "Administrator"}
    >
      <SectionHeading title="Workspace overview" />
      {loading ? <KpiSkeleton /> : (
        <KpiGrid>
          <KpiTile label="Total users" value={totalUsers} icon="users" tone="navy" />
          <KpiTile label="Active users" value={activeUsers} icon="user-check" tone="blue" />
          <KpiTile label="Leads tracked" value={totalLeads} icon="user-plus" tone="orange" />
          <KpiTile label="Invoiced (AED)" value={fmtMoney(invoiced)} icon="dollar-sign" tone="muted" />
        </KpiGrid>
      )}

      <SectionHeading title="Quick actions" />
      <QuickLink icon="users" label="Users & roles" onPress={() => router.push("/admin")} />
      <QuickLink icon="bar-chart-2" label="Reports" onPress={() => router.push("/reports")} />
      <QuickLink icon="file-text" label="Tax invoices" onPress={() => router.push("/accounts")} />
    </DashboardScreen>
  );
}

// ---------------------------------------------------------------------------
// Loading shell shown before /me resolves.
// ---------------------------------------------------------------------------
export function BootingDashboard() {
  return (
    <DashboardScreen title="MA ERP-CRM" subtitle="Loading workspace…">
      <Card>
        <Skeleton height={20} width={140} />
        <Skeleton height={12} width="80%" />
      </Card>
      <KpiSkeleton />
    </DashboardScreen>
  );
}

export function NoAccessDashboard() {
  return (
    <DashboardScreen title="MA ERP-CRM" subtitle="No modules assigned">
      <Card>
        <EmptyState
          icon="lock"
          title="No modules available"
          hint="Your account doesn't have any modules enabled yet. Please contact your administrator."
        />
      </Card>
    </DashboardScreen>
  );
}
