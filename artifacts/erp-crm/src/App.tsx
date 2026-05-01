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
      
      <Route path="/crm/leads" component={LeadsList} />
      <Route path="/crm/contacts" component={ContactsList} />
      <Route path="/crm/deals" component={DealsList} />
      <Route path="/crm/activities" component={ActivitiesList} />
      
      <Route path="/sales/quotations/new" component={QuotationNew} />
      <Route path="/sales/quotations/:id">
        {(params) => <QuotationDetail id={params.id} />}
      </Route>
      <Route path="/sales/quotations" component={QuotationsList} />
      <Route path="/sales/proforma-invoices" component={ProformaInvoicesList} />
      <Route path="/sales/lpos" component={LposList} />
      
      <Route path="/accounts/invoices" component={TaxInvoicesList} />
      <Route path="/accounts/delivery-notes" component={DeliveryNotesList} />
      <Route path="/accounts/expenses" component={ExpensesList} />
      <Route path="/accounts/cheques" component={ChequesList} />
      <Route path="/accounts/bank-accounts" component={BankAccountsList} />
      
      <Route path="/procurement/suppliers" component={SuppliersList} />
      <Route path="/procurement/purchase-requests" component={PurchaseRequestsList} />
      <Route path="/procurement/purchase-orders" component={PurchaseOrdersList} />
      
      <Route path="/inventory/items" component={InventoryItemsList} />
      <Route path="/inventory/stock-entries" component={StockEntriesList} />
      
      <Route path="/projects/:id">
        {(params) => <ProjectDetail id={params.id} />}
      </Route>
      <Route path="/projects" component={ProjectsList} />
      
      <Route path="/hr/employees" component={EmployeesList} />
      <Route path="/hr/attendance" component={AttendanceList} />
      
      <Route path="/assets" component={AssetsList} />
      
      <Route path="/reports" component={ReportsHub} />
      
      <Route path="/admin/users" component={UsersList} />
      <Route path="/admin/audit-logs" component={AuditLogsList} />
      
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
