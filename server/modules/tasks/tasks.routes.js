import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { TasksController } from "./tasks.controller.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientFolder = req?.tenant?.subdomain || "default";
    const dir = path.join("uploads", "tasks", clientFolder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `task_${req.params.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/files/download/*", TasksController.downloadFile);

router.get("/", TasksController.list);
router.get("/:id", TasksController.getById);
router.post("/", TasksController.create);
router.put("/:id", TasksController.update);
router.delete("/:id", TasksController.remove);

router.post("/:id/publish", TasksController.publish);
router.post("/:id/unpublish", TasksController.unpublish);
router.post("/:id/accept", TasksController.accept);
router.post("/:id/unaccept", TasksController.unaccept);
router.post("/:id/complete", TasksController.complete);
router.post("/:id/uncomplete", TasksController.uncomplete);
router.post("/:id/cancel", TasksController.cancel);
router.post("/:id/uncancel", TasksController.uncancel);

router.post("/:id/comments", TasksController.addComment);
router.delete("/:id/comments/:commentId", TasksController.removeComment);

router.post("/:id/files", upload.single("file"), TasksController.uploadFile);
router.delete("/:id/files/:fileId", TasksController.removeFile);

export default router;
