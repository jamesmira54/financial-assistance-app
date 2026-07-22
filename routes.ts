import { Router } from "express";
import { logger } from "./middleware/logger";
import authController from "./authentication/controller";
import fileController from './file/controller';
import userController from './user/controller';
import addressController from './address/controller';
import roleController from './roles/controller';
import schoolController from './school/controller';
import { allowRoles, authentication } from "./middleware/authentication";
import studentController from "./student/controller";
import parameters from "./middleware/parameters";
import academicYearController from "./academicYear/controller";
import sponsorshipController from "./sponsorship/controller";
import announcementController from "./announcement/controller";
import scheduleController from "./schedule/controller";
import dashboardController from "./dashboard/controller";
import resourceController from "./resources/controller";
import notificationController from "./notification/controller";
import faqController from "./faq/controller";
import staticContentController from "./staticContent/controller";
import publicController from "./public/controller";
import monitoringController from "./monitoring/controller";

const routes = Router();

routes.use(logger);
routes.use(parameters);
routes.use("/auth", authController());
routes.use("/roles", authentication, allowRoles('system admin'), roleController());
routes.use('/students', authentication, studentController());
routes.use("/file-uploads", authentication, fileController());
routes.use("/users", authentication, userController())
routes.use("/address", authentication, addressController());
routes.use("/schools", authentication, schoolController());
routes.use("/academic-years", authentication, academicYearController())
routes.use("/sponsorships", authentication, sponsorshipController())
routes.use("/announcements", authentication, announcementController())
routes.use("/schedules", authentication, scheduleController())
routes.use("/dashboard", authentication, dashboardController());
routes.use("/resources", resourceController()); // Public listing, auth required for CRUD
routes.use("/notifications", authentication, notificationController());
routes.use("/faqs", faqController()); // Public listing, auth required for CRUD
routes.use("/static-content", staticContentController()); // Public listing, auth required for CRUD
routes.use("/public", publicController()); // No authentication required
routes.use("/monitoring", authentication, monitoringController());

routes.get("/verify", authentication, (req, res) => {
    res.json({ valid: true, message: "you have access to this api" });
})

export default routes;