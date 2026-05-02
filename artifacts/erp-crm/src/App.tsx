import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { Login } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { LeadsList } from "@/pages/crm/leads";
import { ContactsList } from "@/pages/crm/contacts";
import { DealsList } from "@/pages/crm/deals";
import { ActivitiesList } from "@/pages/crm/activities";
import { QuotationsList } from "@/pages/sales/quotations";
import { QuotationDetail } from "@/pages/sales/quotation-detail";
import { QuotationNew } from "@/pages/sales/quotation-new";
import { ProformaInvoicesList } from "@/pages/sales/proforma-invoices";
import { LposList } from "@/pages/sales/lpos";
import { TaxInvoicesList } from "@/pages/accounts/invoices";
import { DeliveryNotesList } from "@/pages/accounts/delivery-notes";
import { ExpensesList } from "@/pages/accounts/expenses";
import { ChequesList } from "@/pages/accounts/cheques";
import { BankAccountsList } from "@/pages/accounts/bank-accounts";
import { SuppliersList } from "@/pages/procurement/suppliers";
import { PurchaseRequestsList } from "@/pages/procurement/purchase-requests";
import { PurchaseOrdersList } from "@/pages/procurement/purchase-orders";
import { InventoryItemsList } from "@/pages/inventory/items";
import { StockEntriesList } from "@/pages/inventory/stock-entries";
import { ProjectsList } from "@/pages/projects/index";
import { ProjectDetail } from "@/pages/projects/detail";
import { EmployeesList } from "@/pages/hr/employees";
import { AttendanceList } from "@/pages/hr/attendance";
import { AssetsList } from "@/pages/assets/index";
import { ReportsHub } from "@/pages/reports/index";
import { UsersList } from "@/pages/admin/users";
import { AuditLogsList } from "@/pages/admin/audit-logs";
import { CompaniesAdmin } from "@/pages/admin/companies";
import { DepartmentsAdmin } from "@/pages/admin/departments";
import { RolesAdmin } from "@/pages/admin/roles";
import { AdminGuard } from "@/components/AdminGuard";
import { ModuleGuard } from "@/components/ModuleGuard";
import { NotificationsList } from "@/pages/notifications/index";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />

      <Route path="/crm/leads">
        <ModuleGuard module="leads"><LeadsList /></ModuleGuard>
      </Route>
      <Route path="/crm/contacts">
        <ModuleGuard module="contacts"><ContactsList /></ModuleGuard>
      </Route>
      <Route path="/crm/deals">
        <ModuleGuard module="deals"><DealsList /></ModuleGuard>
      </Route>
      <Route path="/crm/activities">
        <ModuleGuard module="activities"><ActivitiesList /></ModuleGuard>
      </Route>

      <Route path="/sales/quotations/new">
        <ModuleGuard module="quotations" action="canCreate"><QuotationNew /></ModuleGuard>
      </Route>
      <Route path="/sales/quotations/:id">
        {(params) => (
          <ModuleGuard module="quotations"><QuotationDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/sales/quotations">
        <ModuleGuard module="quotations"><QuotationsList /></ModuleGuard>
      </Route>
      <Route path="/sales/proforma-invoices">
        <ModuleGuard module="proforma_invoices"><ProformaInvoicesList /></ModuleGuard>
      </Route>
      <Route path="/sales/lpos">
        <ModuleGuard module="lpos"><LposList /></ModuleGuard>
      </Route>

      <Route path="/accounts/invoices">
        <ModuleGuard module="tax_invoices"><TaxInvoicesList /></ModuleGuard>
      </Route>
      <Route path="/accounts/delivery-notes">
        <ModuleGuard module="delivery_notes"><DeliveryNotesList /></ModuleGuard>
      </Route>
      <Route path="/accounts/expenses">
        <ModuleGuard module="expenses"><ExpensesList /></ModuleGuard>
      </Route>
      <Route path="/accounts/cheques">
        <ModuleGuard module="cheques"><ChequesList /></ModuleGuard>
      </Route>
      <Route path="/accounts/bank-accounts">
        <ModuleGuard module="bank_accounts"><BankAccountsList /></ModuleGuard>
      </Route>

      <Route path="/procurement/suppliers">
        <ModuleGuard module="suppliers"><SuppliersList /></ModuleGuard>
      </Route>
      <Route path="/procurement/purchase-requests">
        <ModuleGuard module="purchase_requests"><PurchaseRequestsList /></ModuleGuard>
      </Route>
      <Route path="/procurement/purchase-orders">
        <ModuleGuard module="purchase_orders"><PurchaseOrdersList /></ModuleGuard>
      </Route>

      <Route path="/inventory/items">
        <ModuleGuard module="inventory_items"><InventoryItemsList /></ModuleGuard>
      </Route>
      <Route path="/inventory/stock-entries">
        <ModuleGuard module="stock_entries"><StockEntriesList /></ModuleGuard>
      </Route>

      <Route path="/projects/:id">
        {(params) => (
          <ModuleGuard module="projects"><ProjectDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/projects">
        <ModuleGuard module="projects"><ProjectsList /></ModuleGuard>
      </Route>

      <Route path="/hr/employees">
        <ModuleGuard module="employees"><EmployeesList /></ModuleGuard>
      </Route>
      <Route path="/hr/attendance">
        <ModuleGuard module="attendance"><AttendanceList /></ModuleGuard>
      </Route>

      <Route path="/assets">
        <ModuleGuard module="assets"><AssetsList /></ModuleGuard>
      </Route>

      <Route path="/reports">
        <ModuleGuard module="dashboard"><ReportsHub /></ModuleGuard>
      </Route>

      <Route path="/admin/companies">
        <AdminGuard><CompaniesAdmin /></AdminGuard>
      </Route>
      <Route path="/admin/departments">
        <AdminGuard><DepartmentsAdmin /></AdminGuard>
      </Route>
      <Route path="/admin/users">
        <AdminGuard><UsersList /></AdminGuard>
      </Route>
      <Route path="/admin/roles">
        <AdminGuard><RolesAdmin /></AdminGuard>
      </Route>
      <Route path="/admin/audit-logs">
        <AdminGuard><AuditLogsList /></AdminGuard>
      </Route>

      <Route path="/notifications" component={NotificationsList} />

      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppLayout>
            <Router />
          </AppLayout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
