import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as facePassesController from "./facePasses.controller.js";
import multer from "multer";
const upload = multer().any();

const router = Router();

router.get("/", authMiddleware, facePassesController.getFacePasses);
router.get("/:id", authMiddleware, facePassesController.getFacePassById);
router.put("/:id", authMiddleware, facePassesController.editFacePass);
router.delete("/:id", authMiddleware, facePassesController.removeFacePass);

export default router;
