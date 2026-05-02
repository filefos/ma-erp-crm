import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { Login } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { CRMDashboard } from "@/pages/crm/dashboard";
import { SalesPipeline } from "@/pages/crm/pipeline";
import { FollowUpCenter } from "@/pages/crm/follow-ups";
import { SalesLeaderboard } from "@/pages/crm/leaderboard";
import { CRMReports } from "@/pages/crm/reports";
import { LeadsList } from "@/pages/crm/leads";
import { LeadDetail } from "@/pages/crm/lead-detail";
import { ContactsList } from "@/pages/crm/contacts";
import { DealsList } from "@/pages/crm/deals";
import { ActivitiesList } from "@/pages/crm/activities";
import { QuotationsList } from "@/pages/sales/quotations";
import { QuotationDetail } from "@/pages/sales/quotation-detail";
import { QuotationNew } from "@/pages/sales/quotation-new";
import { QuotationEdit } from "@/pages/sales/quotation-edit";
import { ProformaInvoicesList } from "@/pages/sales/proforma-invoices";
import { ProformaInvoiceDetail } from "@/pages/sales/proforma-invoice-detail";
import { ProformaInvoiceEdit } from "@/pages/sales/proforma-invoice-edit";
import { LposList } from "@/pages/sales/lpos";
import { TaxInvoicesList } from "@/pages/accounts/invoices";
import { InvoiceDetail } from "@/pages/accounts/invoice-detail";
import { InvoiceEdit } from "@/pages/accounts/invoice-edit";
import { DeliveryNotesList } from "@/pages/accounts/delivery-notes";
import { DeliveryNoteDetail } from "@/pages/accounts/delivery-note-detail";
import { ExpensesList } from "@/pages/accounts/expenses";
import { ChequesList } from "@/pages/accounts/cheques";
import { BankAccountsList } from "@/pages/accounts/bank-accounts";
import { ChartOfAccountsList } from "@/pages/accounts/chart-of-accounts";
import { PaymentsReceivedList } from "@/pages/accounts/payments-received";
import { PaymentsMadeList } from "@/pages/accounts/payments-made";
import { JournalEntriesList } from "@/pages/accounts/journal-entries";
import { VatReport } from "@/pages/accounts/vat-report";
import { AiAssistant } from "@/pages/accounts/ai-assistant";
import { SuppliersList } from "@/pages/procurement/suppliers";
import { PurchaseRequestsList } from "@/pages/procurement/purchase-requests";
import { PurchaseOrdersList } from "@/pages/procurement/purchase-orders";
import { PurchaseOrderDetail } from "@/pages/procurement/purchase-order-detail";
import { RfqsList } from "@/pages/procurement/rfqs";
import { SupplierQuotationsList } from "@/pages/procurement/supplier-quotations";
import ProcurementDashboardPage from "@/pages/procurement/procurement-dashboard";
import { ChequeDetail } from "@/pages/accounts/cheque-detail";
import { InventoryItemsList } from "@/pages/inventory/items";
import { StockEntriesList } from "@/pages/inventory/stock-entries";
import { InventoryDashboard } from "@/pages/inventory/dashboard";
import { ProjectsList } from "@/pages/projects/index";
import { ProjectDetail } from "@/pages/projects/detail";
import { SalesPerformance } from "@/pages/projects/sales-performance";
import { EmployeesList } from "@/pages/hr/employees";
import { AttendanceList } from "@/pages/hr/attendance";
import { AssetsList } from "@/pages/assets/index";
import { ReportsHub } from "@/pages/reports/index";
import { SalesPipelineReport } from "@/pages/reports/sales-pipeline";
import { QuotationsReport } from "@/pages/reports/quotations-report";
import { RevenueReport } from "@/pages/reports/revenue-report";
import { ExpensesReport } from "@/pages/reports/expenses-report";
import { InventoryReport } from "@/pages/reports/inventory-report";
import { ProjectsReport } from "@/pages/reports/projects-report";
import { AttendanceReport } from "@/pages/reports/attendance-report";
import { ProcurementReport } from "@/pages/reports/procurement-report";
import { UsersList } from "@/pages/admin/users";
import { AuditLogsList } from "@/pages/admin/audit-logs";
import { CompaniesAdmin } from "@/pages/admin/companies";
import { DepartmentsAdmin } from "@/pages/admin/departments";
import { RolesAdmin } from "@/pages/admin/roles";
import { AdminEmailPanel } from "@/pages/admin/emails";
import { AdminGuard } from "@/components/AdminGuard";
import { ModuleGuard } from "@/components/ModuleGuard";
import { NotificationsList } from "@/pages/notifications/index";
import { MyProfile } from "@/pages/profile/index";
import { EmailPanel } from "@/pages/email/index";
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

      {/* CRM */}
      <Route path="/crm">
        <ModuleGuard module="leads"><CRMDashboard /></ModuleGuard>
      </Route>
      <Route path="/crm/pipeline">
        <ModuleGuard module="deals"><SalesPipeline /></ModuleGuard>
      </Route>
      <Route path="/crm/follow-ups">
        <ModuleGuard module="leads"><FollowUpCenter /></ModuleGuard>
      </Route>
      <Route path="/crm/leaderboard">
        <ModuleGuard module="leads"><SalesLeaderboard /></ModuleGuard>
      </Route>
      <Route path="/crm/reports">
        <ModuleGuard module="leads"><CRMReports /></ModuleGuard>
      </Route>
      <Route path="/crm/leads/:id">
        {(params) => (
          <ModuleGuard module="leads"><LeadDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
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

      {/* Sales */}
      <Route path="/sales/quotations/new">
        <ModuleGuard module="quotations" action="canCreate"><QuotationNew /></ModuleGuard>
      </Route>
      <Route path="/sales/quotations/:id/edit">
        {(params) => (
          <ModuleGuard module="quotations" action="canCreate"><QuotationEdit id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/sales/quotations/:id">
        {(params) => (
          <ModuleGuard module="quotations"><QuotationDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/sales/quotations">
        <ModuleGuard module="quotations"><QuotationsList /></ModuleGuard>
      </Route>
      <Route path="/sales/proforma-invoices/:id/edit">
        {(params) => (
          <ModuleGuard module="proforma_invoices" action="canCreate"><ProformaInvoiceEdit id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/sales/proforma-invoices/:id">
        {(params) => (
          <ModuleGuard module="proforma_invoices"><ProformaInvoiceDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/sales/proforma-invoices">
        <ModuleGuard module="proforma_invoices"><ProformaInvoicesList /></ModuleGuard>
      </Route>
      <Route path="/sales/lpos">
        <ModuleGuard module="lpos"><LposList /></ModuleGuard>
      </Route>

      {/* Accounts */}
      <Route path="/accounts/invoices/:id/edit">
        {(params) => (
          <ModuleGuard module="tax_invoices" action="canCreate"><InvoiceEdit id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/accounts/invoices/:id">
        {(params) => (
          <ModuleGuard module="tax_invoices"><InvoiceDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/accounts/invoices">
        <ModuleGuard module="tax_invoices"><TaxInvoicesList /></ModuleGuard>
      </Route>
      <Route path="/accounts/delivery-notes/:id">
        {(params) => (
          <ModuleGuard module="delivery_notes"><DeliveryNoteDetail id={params.id} /></ModuleGuard>
        )}
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
      <Route path="/accounts/payments-received">
        <ModuleGuard module="expenses"><PaymentsReceivedList /></ModuleGuard>
      </Route>
      <Route path="/accounts/payments-made">
        <ModuleGuard module="expenses"><PaymentsMadeList /></ModuleGuard>
      </Route>
      <Route path="/accounts/chart-of-accounts">
        <ModuleGuard module="expenses"><ChartOfAccountsList /></ModuleGuard>
      </Route>
      <Route path="/accounts/journal-entries">
        <ModuleGuard module="expenses"><JournalEntriesList /></ModuleGuard>
      </Route>
      <Route path="/accounts/vat-report">
        <ModuleGuard module="expenses"><VatReport /></ModuleGuard>
      </Route>
      <Route path="/accounts/ai-assistant">
        <ModuleGuard module="expenses"><AiAssistant /></ModuleGuard>
      </Route>

      {/* Procurement */}
      <Route path="/procurement/dashboard">
        <ModuleGuard module="suppliers"><ProcurementDashboardPage /></ModuleGuard>
      </Route>
      <Route path="/procurement/suppliers">
        <ModuleGuard module="suppliers"><SuppliersList /></ModuleGuard>
      </Route>
      <Route path="/procurement/purchase-requests">
        <ModuleGuard module="purchase_requests"><PurchaseRequestsList /></ModuleGuard>
      </Route>
      <Route path="/procurement/rfqs">
        <ModuleGuard module="purchase_requests"><RfqsList /></ModuleGuard>
      </Route>
      <Route path="/procurement/supplier-quotations">
        <ModuleGuard module="purchase_requests"><SupplierQuotationsList /></ModuleGuard>
      </Route>
      <Route path="/procurement/purchase-orders/:id">
        {(params) => (
          <ModuleGuard module="purchase_orders"><PurchaseOrderDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/procurement/purchase-orders">
        <ModuleGuard module="purchase_orders"><PurchaseOrdersList /></ModuleGuard>
      </Route>

      {/* Inventory */}
      <Route path="/inventory">
        <ModuleGuard module="inventory_items"><InventoryDashboard /></ModuleGuard>
      </Route>
      <Route path="/inventory/dashboard">
        <ModuleGuard module="inventory_items"><InventoryDashboard /></ModuleGuard>
      </Route>
      <Route path="/inventory/items">
        <ModuleGuard module="inventory_items"><InventoryItemsList /></ModuleGuard>
      </Route>
      <Route path="/inventory/stock-entries">
        <ModuleGuard module="stock_entries"><StockEntriesList /></ModuleGuard>
      </Route>

      {/* Projects */}
      <Route path="/projects/sales-performance">
        <ModuleGuard module="projects"><SalesPerformance /></ModuleGuard>
      </Route>
      <Route path="/projects/:id">
        {(params) => (
          <ModuleGuard module="projects"><ProjectDetail id={params.id} /></ModuleGuard>
        )}
      </Route>
      <Route path="/projects">
        <ModuleGuard module="projects"><ProjectsList /></ModuleGuard>
      </Route>

      {/* HR */}
      <Route path="/hr/employees">
        <ModuleGuard module="employees"><EmployeesList /></ModuleGuard>
      </Route>
      <Route path="/hr/attendance">
        <ModuleGuard module="attendance"><AttendanceList /></ModuleGuard>
      </Route>

      {/* Assets */}
      <Route path="/assets">
        <ModuleGuard module="assets"><AssetsList /></ModuleGuard>
      </Route>

      {/* Reports hub + sub-pages */}
      <Route path="/reports/sales-pipeline">
        <ModuleGuard module="dashboard"><SalesPipelineReport /></ModuleGuard>
      </Route>
      <Route path="/reports/quotations">
        <ModuleGuard module="dashboard"><QuotationsReport /></ModuleGuard>
      </Route>
      <Route path="/reports/revenue">
        <ModuleGuard module="dashboard"><RevenueReport /></ModuleGuard>
      </Route>
      <Route path="/reports/expenses">
        <ModuleGuard module="dashboard"><ExpensesReport /></ModuleGuard>
      </Route>
      <Route path="/reports/inventory">
        <ModuleGuard module="dashboard"><InventoryReport /></ModuleGuard>
      </Route>
      <Route path="/reports/projects">
        <ModuleGuard module="dashboard"><ProjectsReport /></ModuleGuard>
      </Route>
      <Route path="/reports/attendance">
        <ModuleGuard module="dashboard"><AttendanceReport /></ModuleGuard>
      </Route>
      <Route path="/reports/procurement">
        <ModuleGuard module="dashboard"><ProcurementReport /></ModuleGuard>
      </Route>
      <Route path="/reports">
        <ModuleGuard module="dashboard"><ReportsHub /></ModuleGuard>
      </Route>

      {/* Admin */}
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
      <Route path="/admin/emails">
        <AdminGuard><AdminEmailPanel /></AdminGuard>
      </Route>

      <Route path="/procurement/purchase-orders/:id">
        {(params) => <ModuleGuard module="purchase_orders"><PurchaseOrderDetail id={params.id!} /></ModuleGuard>}
      </Route>
      <Route path="/accounts/cheques/:id">
        {(params) => <ChequeDetail id={params.id!} />}
      </Route>

      <Route path="/notifications" component={NotificationsList} />
      <Route path="/profile" component={MyProfile} />
      <Route path="/email" component={EmailPanel} />

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
