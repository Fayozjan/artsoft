import { Router } from "express";
import * as ctrl from "./tenants.controller.js";

const router = Router();

const superAdminAuth = (req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (!key || key !== process.env.SUPER_ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

router.use(superAdminAuth);

router.get("/", ctrl.getTenants);
router.post("/migrate-all", ctrl.migrateAll);
router.get("/:id", ctrl.getTenantById);
router.post("/", ctrl.createTenant);
router.post("/:id/reseed", ctrl.reseedTenant);

export default router;
