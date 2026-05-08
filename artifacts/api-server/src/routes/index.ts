import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import companiesRouter from "./companies";
import departmentsRouter from "./departments";
import usersRouter from "./users";
import leadsRouter from "./leads";
import contactsRouter from "./contacts";
import quotationsRouter from "./quotations";
import invoicesRouter from "./invoices";
import projectsRouter from "./projects";
import salesTargetsRouter from "./sales-targets";
import procurementRouter from "./procurement";
import supplierRegistrationsRouter from "./supplier-registrations";
import inventoryRouter from "./inventory";
import assetsRouter from "./assets";
import hrRouter from "./hr";
import offerLettersRouter from "./offer-letters";
import payrollRouter from "./payroll";
import financeRouter from "./finance";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import rolesRouter from "./roles";
import emailsRouter from "./emails";
import emailSettingsRouter from "./email-settings";
import aiRouter from "./ai";
import adminResetRouter from "./admin-reset";
import activityRouter from "./activity";
import deployRouter from "./deploy";
import delegatedTasksRouter from "./delegated-tasks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
// Public supplier-registration endpoints (categories list + submit) MUST be
// mounted before any router that calls `router.use(requireAuth)`, because
// Express propagates sub-router middleware into the parent chain. The admin
// endpoints inside this router still gate themselves explicitly.
router.use(supplierRegistrationsRouter);
router.use(companiesRouter);
router.use(departmentsRouter);
router.use(usersRouter);
router.use(rolesRouter);
router.use(leadsRouter);
router.use(contactsRouter);
router.use(quotationsRouter);
router.use(invoicesRouter);
router.use(projectsRouter);
router.use(salesTargetsRouter);
router.use(procurementRouter);
router.use(inventoryRouter);
router.use(assetsRouter);
router.use(hrRouter);
router.use(offerLettersRouter);
router.use(payrollRouter);
router.use(financeRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(emailsRouter);
router.use(emailSettingsRouter);
router.use(aiRouter);
router.use(adminResetRouter);
router.use(activityRouter);
router.use(deployRouter);
router.use(delegatedTasksRouter);

export default router;
