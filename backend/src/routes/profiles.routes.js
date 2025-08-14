import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  listProfiles,
  updateProfile,
  upload,
  uploadPicture,
  mongoHealthCheck,
} from "../controllers/profiles.controller.js";

const router = Router();

router.get("/", requireAuth, listProfiles);
router.put("/:id", requireAuth, updateProfile);
router.post(
  "/:id/picture",
  requireAuth,
  upload.single("profilePicture"),
  uploadPicture
);
router.get("/mongo-health", mongoHealthCheck);

export default router;
